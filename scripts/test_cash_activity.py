"""Run explicitly: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import unittest
from decimal import Decimal
from import_cash_flow import extract_cash_activity

class CashActivityTests(unittest.TestCase):
    def test_both_exchange_directions_and_external_flows(self):
        text = '''DEPOSIT & WITHDRAWAL RECORDS
Deposits
10/11/2025 THB Deposit Refund 600.00
Withdrawals
12/11/2025 THB -300.00
CURRENCY EXCHANGE RECORDS
10/11/2025 13:01:34,GMT+07 THB 600.00 USD 20.00 30.0000
12/11/2025 13:01:34,GMT+07 USD 10.00 THB 310.00 31.0000
DIVIDENDS
'''
        rows = {'Deposits':{'THB':Decimal(600),'USD':Decimal(0)},
                'Withdrawals':{'THB':Decimal(-300),'USD':Decimal(0)},
                'Currency Exchange':{'THB':Decimal(-290),'USD':Decimal(10)}}
        entries = extract_cash_activity(text, 'test.PDF', rows, ['THB','USD'])
        self.assertEqual(len(entries),4)
        self.assertEqual(entries[1]['type'],'WITHDRAWAL')
        self.assertEqual(entries[1]['amount'],300)
        self.assertEqual(entries[2]['fromCurrency'],'THB')
        self.assertEqual(entries[3]['fromCurrency'],'USD')
        self.assertEqual(entries[3]['rate'],31)
        self.assertEqual(len({a['id'] for a in entries}),4)
        rows['Withdrawals']['THB'] = Decimal(-301)
        with self.assertRaisesRegex(ValueError, 'Withdrawals records do not match'):
            extract_cash_activity(text,'test.PDF',rows,['THB','USD'])

    def test_empty_sections_require_zero_summary(self):
        rows = {k:{'THB':Decimal(0)} for k in ['Deposits','Withdrawals','Currency Exchange']}
        self.assertEqual(extract_cash_activity('', 'test.PDF', rows, ['THB']), [])
        rows['Currency Exchange']['THB'] = Decimal(100)
        with self.assertRaisesRegex(ValueError,'FX records do not match'):
            extract_cash_activity('', 'test.PDF', rows, ['THB'])

if __name__ == '__main__':
    unittest.main()
