import { expect, test } from '@jest/globals'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MortgageAssistant from '../pages/mortgage-assistant'

test('assistant keeps chat and uncalculated estimates together without calculator fields', () => {
  const html = renderToStaticMarkup(createElement(MortgageAssistant))

  expect(html).toContain('Mortgage Assistant')
  expect(html).toContain('Mortgage conversation')
  expect(html).toContain('Mortgage results')
  expect(html).toContain('Not calculated')
  expect(html).not.toContain('name="price"')
  expect(html).not.toContain('Homewise')
})