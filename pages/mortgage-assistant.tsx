import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Chatbot, {
  ChatbotMortgageResults,
  MortgageComparison,
  MortgageInputs,
} from '@/components/Chatbot/Chatbot'
import styles from '@/styles/assistant.module.css'

const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const money = (value: number) => currency.format(value)

function BalanceChart({ results }: { results: ChatbotMortgageResults }) {
  if (!results.remainingBalance?.length || results.capitalPaid <= 0) return null
  const schedule = [{ year: 0, balance: results.capitalPaid }, ...results.remainingBalance]
  const finalYear = schedule[schedule.length - 1].year
  const points = schedule.map(({ year, balance }) =>
    `${8 + year / finalYear * 304},${12 + (1 - balance / results.capitalPaid) * 106}`
  ).join(' ')

  return (
    <figure className={styles.chart}>
      <figcaption>Remaining mortgage balance</figcaption>
      <svg viewBox="0 0 320 132" role="img" aria-label={`Mortgage balance reduces from ${money(results.capitalPaid)} to zero over ${finalYear} years`}>
        <path d="M8 12H312 M8 65H312 M8 118H312" stroke="var(--line)" strokeDasharray="3 4" fill="none" />
        <polygon points={`8,118 ${points} 312,118`} fill="var(--accent-soft)" />
        <polyline points={points} fill="none" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <div className={styles.chartAxis}><span>Today</span><span>Year {finalYear}</span></div>
    </figure>
  )
}

const MortgageAssistant = () => {
  const [chatbotResults, setChatbotResults] =
    useState<ChatbotMortgageResults | null>(null)
  const [comparison, setComparison] = useState<MortgageComparison | null>(null)
  const [inputs, setInputs] = useState<MortgageInputs | null>(null)

  const handleCalculation = (results: ChatbotMortgageResults, originalInputs?: MortgageInputs) => {
    setChatbotResults(results)
    setComparison(null)
    setInputs(originalInputs || null)
  }

  return (
    <div className={styles.page}>
      <Head><title>Mortgage Assistant</title></Head>
      <a href="#conversation" className={styles.skipLink}>Skip to conversation</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.wordmark}><span className={styles.brandMark} aria-hidden="true" /><span>Mortgage Assistant</span></div>
          <Link href="/mortgage-calculator" className={styles.calculatorLink}>Mortgage calculator <span aria-hidden="true">&rarr;</span></Link>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.pageHeading}><div><p className={styles.eyebrow}>YOUR HOME. YOUR NUMBERS.</p><h1>A clearer view of your mortgage.</h1></div><span className={styles.estimateBadge}>Repayment estimates</span></div>
        <div className={styles.workspace}>
          <section id="conversation" className={styles.conversationSection} aria-label="Mortgage conversation">
            <Chatbot setChatbotResults={handleCalculation} setComparison={setComparison} />
          </section>
          <aside className={styles.results} aria-label="Mortgage results" aria-live="polite">
            <div className={styles.resultsHeader}><span className={styles.eyebrow}>{comparison ? 'YOUR OPTIONS' : 'YOUR ESTIMATE'}</span><span className={styles.resultState}>{chatbotResults || comparison ? 'Calculated' : 'Not calculated'}</span></div>
            {comparison ? (
              <>
                <div className={styles.comparisonTitle}><h2>Deposit comparison</h2><button className={styles.textButton} type="button" onClick={() => setComparison(null)}>Back to estimate</button></div>
                <div className={styles.paymentSummary}><p>{comparison.delta.monthlyPayment <= 0 ? 'Monthly repayment reduction' : 'Monthly repayment increase'}</p><strong>{money(Math.abs(comparison.delta.monthlyPayment))}<span>/ month</span></strong><p>{money(Math.abs(comparison.delta.totalInterest))} {comparison.delta.totalInterest <= 0 ? 'less' : 'more'} interest over the term</p></div>
                <p className={styles.propertyPrice}>Property price <strong>{money(comparison.originalPrice)}</strong></p>
                <div className={styles.tableWrap}><table className={styles.comparisonTable}><caption className={styles.srOnly}>Current deposit and increased deposit mortgage comparison</caption><thead><tr><th scope="col">The detail</th><th scope="col">Current</th><th scope="col">Higher deposit</th></tr></thead><tbody>{[
                  ['Deposit', comparison.originalPrice - comparison.original.results.capitalPaid, comparison.originalPrice - comparison.scenario.results.capitalPaid],
                  ['Borrowing', comparison.original.results.capitalPaid, comparison.scenario.results.capitalPaid],
                  ['Monthly repayment', comparison.original.results.monthlyPayment, comparison.scenario.results.monthlyPayment],
                  ['Total interest', comparison.original.results.interestPaid, comparison.scenario.results.interestPaid],
                  ['Total repayments', comparison.original.results.totalCost, comparison.scenario.results.totalCost],
                ].map(([label, original, scenario]) => <tr key={label}><th scope="row">{label}</th><td>{money(Number(original))}</td><td>{money(Number(scenario))}</td></tr>)}</tbody></table></div>
                <p className={styles.disclaimer}>Same rate and term in both scenarios. A larger deposit uses more cash upfront; it does not guarantee a better rate.</p>
              </>
            ) : chatbotResults ? (
              <>
                <h2>{chatbotResults.fundingType === 'cash' ? 'Cash purchase' : 'Your mortgage, at a glance.'}</h2>
                {chatbotResults.fundingType === 'cash' ? <div className={styles.paymentSummary}><p>Purchase price</p><strong>{money(chatbotResults.purchasePrice || 0)}</strong><p>No mortgage borrowing or repayments required.</p></div> : <>
                  <div className={styles.paymentSummary}><p>Estimated monthly repayment</p><strong>{money(chatbotResults.monthlyPayment)}<span>/ month</span></strong><p>Capital and interest repayments</p></div>
                  <dl className={styles.breakdown}><div><dt>Mortgage borrowing</dt><dd>{money(chatbotResults.capitalPaid)}</dd></div><div><dt>Total interest</dt><dd>{money(chatbotResults.interestPaid)}</dd></div><div><dt>Total mortgage repayments</dt><dd>{money(chatbotResults.totalCost)}</dd></div></dl>
                  <BalanceChart results={chatbotResults} />
                </>}
                {inputs && <dl className={styles.assumptions}><div><dt>Property</dt><dd>{money(inputs.price)}</dd></div><div><dt>Deposit</dt><dd>{money(inputs.deposit)}</dd></div><div><dt>Annual rate</dt><dd>{inputs.interestRate}%</dd></div><div><dt>Term</dt><dd>{inputs.termYears} years</dd></div></dl>}
                <p className={styles.disclaimer}>Assumes an unchanged rate over the full term. Excludes purchase taxes, fees and other buying costs.</p>
              </>
            ) : (
              <div className={styles.emptyResults}><h2>Your mortgage,<br />at a glance.</h2><div className={styles.emptyPayment}><p>Estimated monthly repayment</p><strong>&pound;&nbsp;&mdash;<span>/ month</span></strong></div><dl className={styles.breakdown}><div><dt>Mortgage borrowing</dt><dd>&mdash;</dd></div><div><dt>Total interest</dt><dd>&mdash;</dd></div><div><dt>Total mortgage repayments</dt><dd>&mdash;</dd></div></dl><div className={styles.emptyRule} /><p className={styles.disclaimer}>No assumptions. No figures until your scenario is calculated.</p></div>
            )}
          </aside>
        </div>
        <footer className={styles.footer}><span>Mortgage Assistant</span><p>Illustrative estimates, not financial advice, a mortgage offer or a lender eligibility decision.</p></footer>
      </main>
    </div>
  )
}

export default MortgageAssistant
