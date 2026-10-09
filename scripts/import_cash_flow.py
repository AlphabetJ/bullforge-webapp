"""Explicit, offline Webull PDF extraction; never called by the web server."""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
LABELS = ['Opening Cash', 'Deposits', 'Withdrawals', 'Trades (Sold)', 'Trades (Bought)',
          'Currency Exchange', 'Comm/Fee/Tax', 'VAT', 'Corporate Action(Cash)', 'Dividends',
          'Interest', 'Interest WHT', 'Miscellaneous Fees', 'Others', 'Closing Cash']
NUM = r'-?[\d,]+\.\d+'

def number(s):
    return Decimal(s.replace(',', ''))

def iso(s):
    return datetime.strptime(s, '%d/%m/%Y').strftime('%Y-%m-%d')

def extract_cash_activity(text, source, rows, currencies):
    activity = []
    section_titles = ['DEPOSIT & WITHDRAWAL RECORDS', 'CURRENCY EXCHANGE RECORDS',
                      'DIVIDENDS', 'ACCRUED DIVIDENDS', 'INTEREST', 'NOTES']
    def section(title):
        if title not in text:
            return ''
        block = text.split(title, 1)[1]
        ends = [block.index(t) for t in section_titles if t != title and t in block]
        return block[:min(ends)] if ends else block
    kind = None
    for line in section('DEPOSIT & WITHDRAWAL RECORDS').splitlines():
        if line.strip() in ['Deposits', 'Withdrawals']:
            kind = 'DEPOSIT' if line.strip() == 'Deposits' else 'WITHDRAWAL'
        elif re.match(r'^\d{2}/\d{2}/\d{4}\s', line):
            match = re.match(r'^(\d{2}/\d{2}/\d{4})\s+.*?\b([A-Z]{3})\b.*?(' + NUM + r')\s*$', line)
            if not match or not kind:
                raise ValueError(f'{source}: unsupported deposit/withdrawal row')
            value = abs(number(match[3]))
            activity.append(dict(date=iso(match[1]), time=None, type=kind,
                                 currency=match[2], amount=value, source=source))
    for line in section('CURRENCY EXCHANGE RECORDS').splitlines():
        if not re.match(r'^\d{2}/\d{2}/\d{4}\s', line):
            continue
        match = re.fullmatch(r'(\d{2}/\d{2}/\d{4})\s+(\S+)\s+([A-Z]{3})\s+(' + NUM + r')\s+([A-Z]{3})\s+(' + NUM + r')\s+(' + NUM + r')', line)
        if not match:
            raise ValueError(f'{source}: unsupported currency exchange row')
        activity.append(dict(date=iso(match[1]), time=match[2].split(',')[0], type='FX',
                             fromCurrency=match[3], fromAmount=number(match[4]),
                             toCurrency=match[5], toAmount=number(match[6]), rate=number(match[7]), source=source))
    for currency in currencies:
        for kind, label, sign in [('DEPOSIT', 'Deposits', 1), ('WITHDRAWAL', 'Withdrawals', -1)]:
            extracted = sum(a['amount'] * sign for a in activity if a['type']==kind and a['currency']==currency)
            if abs(extracted-rows[label][currency]) > Decimal('0.10'):
                raise ValueError(f'{source}: {label} records do not match summary for {currency}')
        exchanged = sum((a['toAmount'] if a['toCurrency']==currency else 0) -
                        (a['fromAmount'] if a['fromCurrency']==currency else 0)
                        for a in activity if a['type']=='FX')
        if abs(exchanged-rows['Currency Exchange'][currency]) > Decimal('0.10'):
            raise ValueError(f'{source}: FX records do not match summary for {currency}')
    for i, entry in enumerate(activity):
        entry['id'] = f'{source}:{i}'
    return activity

def extract(path):
    with pdfplumber.open(path) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    period = re.search(r'Period:\s*(\d{2}/\d{2}/\d{4})\s*-\s*(\d{2}/\d{2}/\d{4})', text)
    if not period:
        raise ValueError(f'{path.name}: missing statement period')
    rate_match = re.search(r'USD/THB\s*=\s*([\d.]+)', text)
    nav_text = text.split('NET ACCOUNT VALUE (THB)', 1)[1].split('CASH REPORT SUMMARY', 1)[0]
    nav = {}
    for label in ['Opening', 'Closing']:
        nav_match = re.search(r'^' + label + r'\s+(.+)$', nav_text, re.M)
        if not nav_match or not rate_match:
            raise ValueError(f'{path.name}: missing account valuation or exchange rate')
        nav[label] = number(re.findall(NUM, nav_match[1])[-1])
    summary = text.split('CASH REPORT SUMMARY', 1)[1].split('TRADE RECORDS', 1)[0]
    header = re.search(r'^((?:[A-Z]{3} )+)Total\(THB\)$', summary, re.M)
    if not header:
        raise ValueError(f'{path.name}: unsupported currency header')
    currencies = header[1].split()
    rows = {}
    for label in LABELS:
        match = re.search(r'^' + re.escape(label) + r'\s+(.+)$', summary, re.M)
        if not match:
            raise ValueError(f'{path.name}: missing {label}')
        values = re.findall(NUM, match[1])
        if len(values) != len(currencies) + 1:
            raise ValueError(f'{path.name}: invalid columns for {label}')
        rows[label] = dict(zip(currencies, map(number, values[:-1])))
    residuals = {}
    for currency in currencies:
        residual = rows['Opening Cash'][currency] + sum(rows[k][currency] for k in LABELS[1:-1]) - rows['Closing Cash'][currency]
        residuals[currency] = residual
        if abs(residual) > Decimal('0.10'):
            raise ValueError(f'{path.name}: cash does not reconcile for {currency}: {residual}')
    trade_text = text.split('TRADE RECORDS', 1)[1].split('PORTFOLIO SUMMARY', 1)[0]
    lines = trade_text.splitlines()
    trades = []
    for i, line in enumerate(lines):
        match = re.match(r'(\d{2}/\d{2}/\d{4})\s+(\S+)\s+(\d{2}/\d{2}/\d{4})\s+(BUY|SELL)\s+(.+)', line)
        if not match:
            continue
        values = re.findall(NUM + r'|\d+', match[5])
        if len(values) < 6:
            raise ValueError(f'{path.name}: unsupported trade row')
        symbol = lines[i-1].strip()
        if not re.fullmatch(r'[A-Z][A-Z0-9.\-]*', symbol):
            raise ValueError(f'{path.name}: missing trade symbol')
        quantity, price, gross, net, fee, vat = map(number, values[:6])
        trades.append(dict(date=iso(match[1]), time=match[2].split(',')[0], settlementDate=iso(match[3]),
                           symbol=symbol, type=match[4], shares=quantity, price=price, gross=gross,
                           amount=-net if match[4]=='BUY' else net, fees=abs(fee)+abs(vat), currency='USD', source=path.name))
    for action, label in [('BUY', 'Trades (Bought)'), ('SELL', 'Trades (Sold)')]:
        total = sum(t['gross'] for t in trades if t['type']==action)
        if abs(total - abs(rows[label].get('USD', 0))) > Decimal('0.10'):
            raise ValueError(f'{path.name}: {action} trade extraction does not match summary')
    return dict(month=iso(period[1])[:7], start=iso(period[1]), end=iso(period[2]), source=path.name,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), currencies=currencies,
                rows=rows, residuals=residuals, cashActivity=extract_cash_activity(text, path.name, rows, currencies),
                usdThb=number(rate_match[1]),
                openingValueThb=nav['Opening'], closingValueThb=nav['Closing']), trades

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT/'raw_data')
    parser.add_argument('--output', type=Path, default=ROOT/'backend/data/cash-flow.json')
    args = parser.parse_args()
    statements, trades = [], []
    for path in sorted(args.input.glob('PDF-Webull-*.PDF')):
        statement, entries = extract(path)
        if statement['month'] >= '2025-11':
            statements.append(statement)
            trades.extend(entries)
    if not statements:
        raise ValueError('No monthly Webull statements found')
    trades.sort(key=lambda t: (t['date'], t['time'], t['symbol']))
    start = next((i for i,t in enumerate(trades) if t['date']=='2025-11-07' and t['symbol']=='NVDA' and t['type']=='BUY'), None)
    if start is None:
        raise ValueError('Required first BUY NVDA on 7 Nov 2025 was not found')
    payload = dict(importedAt=datetime.now(timezone.utc).isoformat(), periodStart='2025-11-07',
                   statements=statements, trades=trades[start:])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, indent=2, default=lambda x: float(x) if isinstance(x, Decimal) else x)+'\n')
    temp.replace(args.output)
    print(f'Imported {len(statements)} statements and {len(trades[start:])} tracked trades; all cash and trade totals verified.')

if __name__ == '__main__':
    main()
