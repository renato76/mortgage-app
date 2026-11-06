import { expect, test } from '@jest/globals'
import type { GetServerSidePropsContext } from 'next'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MortgageCalculator, { getServerSideProps } from '../pages/mortgage-calculator'
import { calculateMortgageDetails } from '../utils/calculateMortgageDetails'

async function submit(query: GetServerSidePropsContext['query']) {
  const result = await getServerSideProps({ query } as GetServerSidePropsContext)
  if (!('props' in result)) throw new Error('Expected calculator props')
  return await result.props
}

test('initial calculator view has no results or validation errors', async () => {
  expect(await submit({})).toEqual({})
})

test('does not offer unsupported mortgage types', () => {
  const html = renderToStaticMarkup(createElement(MortgageCalculator))

  expect(html).not.toContain('Remortgage')
  expect(html).not.toContain('Interest Only')
  expect(html).not.toContain('radiogroup')
  expect(html).toContain('Property Price')
  expect(html).toContain('Calculate')
})

test.each([0, 5])('form uses the shared engine for a %f%% mortgage', async (rate) => {
  const query = {
    price: '300000', deposit: '60000', interestRate: String(rate), termYears: '25',
  }
  expect(await submit(query)).toEqual({
    ...query,
    ...calculateMortgageDetails(300000, 60000, rate, 25),
  })
})

test.each([
  { price: '-1', deposit: '0', interestRate: '5', termYears: '25' },
  { price: '300000', deposit: '300001', interestRate: '5', termYears: '25' },
  { price: '300000', deposit: '', interestRate: '5', termYears: '25' },
  { price: '300000', deposit: '60000', interestRate: 'Infinity', termYears: '25' },
  { price: '300000', deposit: '60000', interestRate: '5', termYears: '25.5' },
  { price: '300000', deposit: '60000', interestRate: '5', termYears: '0' },
  { price: '300000', deposit: '60000', interestRate: '', termYears: '25' },
  { price: ['300000', '400000'], deposit: '60000', interestRate: '5', termYears: '25' },
])('returns a validation error rather than results for query %j', async (query) => {
  const props = await submit(query)
  expect(props.error).toEqual(expect.any(String))
  expect(props.monthlyPayment).toBeUndefined()
})

test('preserves invalid input so the user can correct it', async () => {
  const query = { price: '300000', deposit: '400000', interestRate: '5', termYears: '25' }
  expect(await submit(query)).toMatchObject(query)
})

test('cash purchases do not require a mortgage rate or term', async () => {
  expect(await submit({ price: '300000', deposit: '300000' })).toMatchObject({
    fundingType: 'cash', purchasePrice: 300000, monthlyPayment: 0, remainingBalance: [],
  })
})