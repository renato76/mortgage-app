import { expect, test } from '@jest/globals'
import {
  calculateMortgageDetails,
  MortgageValidationError,
} from '../utils/calculateMortgageDetails'
import { calculateRemainingBalance } from '../utils/calculateRemainingBalance'

test('calculates a known repayment mortgage using an annual percentage rate', () => {
  const result = calculateMortgageDetails(300000, 60000, 5, 25)

  expect(result.capitalPaid).toBe(240000)
  expect(result.monthlyPayment.toFixed(2)).toBe('1403.02')
  expect(result.totalCost.toFixed(2)).toBe('420904.83')
  expect(result.interestPaid.toFixed(2)).toBe('180904.83')
  expect(result.remainingBalance[0]).toEqual({ year: 1, balance: 235051 })
})

test.each([
  [300000, 60000, 0, 25],
  [200000, 20000, 0, 30],
  [125000, 25000, 0, 30],
  [300000, 60000, 5, 25],
  [200000, 20000, 3.75, 30],
  [450000, 90000, 6.5, 15],
])(
  'verifies totals and balances for price %i, deposit %i, rate %f%%, term %i years',
  (price, deposit, rate, term) => {
    const principal = price - deposit
    const result = calculateMortgageDetails(price, deposit, rate, term)

    for (const key of ['monthlyPayment', 'totalCost', 'capitalPaid', 'interestPaid'] as const) {
      expect(Number.isFinite(result[key])).toBe(true)
    }

    expect(result.capitalPaid).toBe(principal)
    expect(result.interestPaid).toBe(result.totalCost - principal)
    expect(result.totalCost).toBeCloseTo(result.monthlyPayment * term * 12, 8)

    if (rate === 0) {
      expect(result.monthlyPayment).toBe(principal / (term * 12))
      expect(result.totalCost).toBe(principal)
      expect(result.interestPaid).toBe(0)
    }

    expect(result.remainingBalance).toHaveLength(term)
    let previousBalance = principal

    for (let year = 1; year <= term; year++) {
      const monthlyRate = rate / 1200
      const payments = year * 12
      const expectedBalance = rate === 0
        ? principal * (1 - year / term)
        : principal * Math.pow(1 + monthlyRate, payments) -
          result.monthlyPayment * (Math.pow(1 + monthlyRate, payments) - 1) / monthlyRate
      const entry = result.remainingBalance[year - 1]

      expect(entry.year).toBe(year)
      expect(Number.isFinite(entry.balance)).toBe(true)
      expect(entry.balance).toBeGreaterThanOrEqual(0)
      expect(entry.balance).toBeLessThanOrEqual(previousBalance)
      expect(Math.abs(entry.balance - expectedBalance)).toBeLessThanOrEqual(0.500001)
      previousBalance = entry.balance
    }

    expect(result.remainingBalance[term - 1].balance).toBe(0)
    expect(calculateRemainingBalance(principal, rate, term)).toEqual(
      result.remainingBalance
    )
  }
)

test('a larger deposit reduces borrowing, monthly payment, and interest', () => {
  const original = calculateMortgageDetails(300000, 60000, 5, 25)
  const scenario = calculateMortgageDetails(300000, 80000, 5, 25)

  expect(scenario.capitalPaid).toBeLessThan(original.capitalPaid)
  expect(scenario.monthlyPayment).toBeLessThan(original.monthlyPayment)
  expect(scenario.interestPaid).toBeLessThan(original.interestPaid)
})

test.each<[string, unknown, unknown, unknown, unknown]>([
  ['zero price', 0, 0, 5, 25],
  ['negative price', -1, 0, 5, 25],
  ['non-finite price', Infinity, 0, 5, 25],
  ['NaN price', NaN, 0, 5, 25],
  ['string price', '300000', 60000, 5, 25],
  ['missing price', undefined, 0, 5, 25],
  ['unsafe price', Number.MAX_VALUE, 0, 5, 25],
  ['negative deposit', 300000, -1, 5, 25],
  ['excess deposit', 300000, 300001, 5, 25],
  ['non-finite deposit', 300000, Infinity, 5, 25],
  ['NaN deposit', 300000, NaN, 5, 25],
  ['string deposit', 300000, '60000', 5, 25],
  ['null deposit', 300000, null, 5, 25],
  ['negative rate', 300000, 60000, -1, 25],
  ['excess rate', 300000, 60000, 101, 25],
  ['non-finite rate', 300000, 60000, Infinity, 25],
  ['NaN rate', 300000, 60000, NaN, 25],
  ['string rate', 300000, 60000, '5', 25],
  ['null rate', 300000, 60000, null, 25],
  ['missing rate', 300000, 60000, undefined, 25],
  ['zero term', 300000, 60000, 5, 0],
  ['negative term', 300000, 60000, 5, -1],
  ['fractional term', 300000, 60000, 5, 25.5],
  ['excess term', 300000, 60000, 5, 41],
  ['non-finite term', 300000, 60000, 5, Infinity],
  ['NaN term', 300000, 60000, 5, NaN],
  ['string term', 300000, 60000, 5, '25'],
  ['missing term', 300000, 60000, 5, undefined],
])('rejects %s', (_label, price, deposit, rate, term) => {
  expect(() => calculateMortgageDetails(
    price as number,
    deposit as number,
    rate as number | undefined,
    term as number | undefined
  )).toThrow(MortgageValidationError)
})

test('handles a fully cash-funded purchase without mortgage inputs', () => {
  expect(calculateMortgageDetails(300000, 300000)).toEqual({
    fundingType: 'cash',
    purchasePrice: 300000,
    monthlyPayment: 0,
    totalCost: 0,
    capitalPaid: 0,
    interestPaid: 0,
    remainingBalance: [],
  })
})

test('validates supplied mortgage values even for a cash purchase', () => {
  expect(() => calculateMortgageDetails(300000, 300000, -1, 25))
    .toThrow(MortgageValidationError)
})

test.each([0, 1e-12, 100])('accepts supported rate %f with finite results', (rate) => {
  const result = calculateMortgageDetails(300000, 0, rate, 40)

  expect(result.fundingType).toBe('mortgage')
  expect(Number.isFinite(result.monthlyPayment)).toBe(true)
  expect(Number.isFinite(result.totalCost)).toBe(true)
})

test.each([1, 40])('accepts term boundary %i', (term) => {
  expect(calculateMortgageDetails(300000, 60000, 5, term).remainingBalance)
    .toHaveLength(term)
})