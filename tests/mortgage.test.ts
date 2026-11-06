import { expect, test } from '@jest/globals'
import { calculateMortgageDetails } from '../utils/calculateMortgageDetails'
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