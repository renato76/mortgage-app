import { useState } from 'react'
import Head from 'next/head'
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

const comparisonTitles = {
  deposit: 'Deposit comparison',
  term: 'Mortgage term comparison',
  price: 'Offer price comparison',
  rate: 'Interest rate comparison',
  multiple: 'Mortgage scenario comparison',
}
const comparisonNotes = {
  deposit: 'Offer price, rate and term are unchanged. A different deposit changes the cash needed upfront; no mortgage rate is guaranteed.',
  term: 'Offer price, deposit and rate are unchanged. A longer term can reduce monthly repayments while increasing total interest.',
  price: 'Deposit, rate and term are unchanged. Taxes, fees and other purchase costs are not included.',
  rate: 'Offer price, deposit and term are unchanged. This rate is illustrative and is not a guaranteed lender offer.',
  multiple: 'Only the requested mortgage inputs change; all other assumptions stay the same. Taxes, fees and other purchase costs are not included.',
}

const MortgageAssistant = () => {
  const [chatbotResults, setChatbotResults] =
    useState<ChatbotMortgageResults | null>(null)
  const [comparison, setComparison] = useState<MortgageComparison | null>(null)
  const [resultsView, setResultsView] = useState<'estimate' | 'compare'>('estimate')
  const [inputs, setInputs] = useState<MortgageInputs | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const handleCalculation = (results: ChatbotMortgageResults, originalInputs?: MortgageInputs) => {
    setChatbotResults(results)
    setComparison(null)
    setResultsView('estimate')
    setInputs(originalInputs || null)
  }

  const handleComparison = (nextComparison: MortgageComparison) => {
    setComparison(nextComparison)
    setResultsView('compare')
  }

  const handleReset = () => {
    setChatbotResults(null)
    setComparison(null)
    setResultsView('estimate')
    setResetKey(k => k + 1)
  }

  return (
    <div className={styles.page}>
      <Head><title>Mortgage Assistant</title></Head>
      <a href="#conversation" className={styles.skipLink}>Skip to conversation</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.wordmark}><span className={styles.brandMark} aria-hidden="true" /><span>Mortgage Assistant</span></div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.pageHeading}><div><h1>A clearer view of your mortgage.</h1></div></div>
        <div className={styles.workspace}>
          <section id="conversation" className={styles.conversationSection} aria-label="Mortgage conversation">
            <Chatbot key={resetKey} setChatbotResults={handleCalculation} setComparison={handleComparison} />
          </section>
          {(chatbotResults || comparison) && (
            <aside className={styles.results} aria-label="Mortgage results" aria-live="polite">
            {comparison && (
              <div className={styles.resultTabsContainer}>
                <div className={styles.resultTabs} role="group" aria-label="Results view">
                  <button type="button" className={styles.resultTab} aria-pressed={resultsView === 'estimate'} onClick={() => setResultsView('estimate')}>Estimate</button>
                  <button type="button" className={styles.resultTab} aria-pressed={resultsView === 'compare'} onClick={() => setResultsView('compare')}>Compare</button>
                </div>
                <button type="button" onClick={handleReset} className={styles.resetButton} title="Clear results">Reset</button>
              </div>
            )}
            {comparison && resultsView === 'compare' ? (
              <>
                <div className={styles.comparisonTitle}><h2>{comparisonTitles[comparison.scenarioType]}</h2></div>
                <div className={styles.comparisonCards}>
                  <div className={`${styles.comparisonCard} ${comparison.delta.monthlyPayment <= 0 ? styles.cardSavings : styles.cardAdditional}`}>
                    <p className={styles.comparisonCardLabel}>{comparison.delta.monthlyPayment <= 0 ? 'Monthly repayment reduction' : 'Monthly repayment increase'}</p>
                    <strong className={styles.comparisonCardAmount}>{money(Math.abs(comparison.delta.monthlyPayment))}</strong>
                    <p className={styles.comparisonCardSubtext}>/ month</p>
                  </div>
                  <div className={`${styles.comparisonCard} ${comparison.delta.totalInterest < 0 ? styles.cardSavings : styles.cardAdditional}`}>
                    <p className={styles.comparisonCardLabel}>Total {comparison.delta.totalInterest < 0 ? 'interest saved' : 'additional interest'}</p>
                    <strong className={styles.comparisonCardAmount}>{money(Math.abs(comparison.delta.totalInterest))}</strong>
                    <p className={styles.comparisonCardSubtext}>Over the full mortgage term</p>
                  </div>
                </div>
                <div className={styles.tableWrap}><table className={styles.comparisonTable}><caption className={styles.srOnly}>{comparisonTitles[comparison.scenarioType]}: {comparison.original.label} versus {comparison.scenario.label}</caption><thead><tr><th scope="col">The detail</th><th scope="col">{comparison.original.label}</th><th scope="col">Alternative scenario</th></tr></thead><tbody>{[
                  ['Property price', money(comparison.originalInputs.price), money(comparison.scenarioInputs.price)],
                  ['Deposit', money(comparison.originalInputs.deposit), money(comparison.scenarioInputs.deposit)],
                  ['Mortgage term', `${comparison.originalInputs.termYears} years`, `${comparison.scenarioInputs.termYears} years`],
                  ['Annual rate', `${comparison.originalInputs.interestRate}%`, `${comparison.scenarioInputs.interestRate}%`],
                  ['Borrowing', money(comparison.original.results.capitalPaid), money(comparison.scenario.results.capitalPaid)],
                  ['Monthly repayment', money(comparison.original.results.monthlyPayment), money(comparison.scenario.results.monthlyPayment)],
                  ['Total interest', money(comparison.original.results.interestPaid), money(comparison.scenario.results.interestPaid)],
                  ['Total repayments', money(comparison.original.results.totalCost), money(comparison.scenario.results.totalCost)],
                ].map(([label, original, scenario]) => {
                  let rowClass = ''
                  if (label === 'Monthly repayment') {
                    rowClass = comparison.delta.monthlyPayment < 0 ? styles.highlightFavorable : styles.highlightUnfavorable
                  } else if (label === 'Total interest') {
                    rowClass = comparison.delta.totalInterest < 0 ? styles.highlightFavorable : styles.highlightUnfavorable
                  }
                  return <tr key={label} className={rowClass}><th scope="row">{label}</th><td>{original}</td><td>{scenario}</td></tr>
                })}</tbody></table></div>
                <p className={styles.disclaimer}>{comparisonNotes[comparison.scenarioType]}</p>
              </>
            ) : chatbotResults ? (
              <>
                <h2>{chatbotResults.fundingType === 'cash' ? 'Cash purchase' : 'Your mortgage, at a glance.'}</h2>
                {chatbotResults.fundingType === 'cash' ? <div className={styles.paymentSummary}><p>Purchase price</p><strong>{money(chatbotResults.purchasePrice || 0)}</strong><p>No mortgage borrowing or repayments required.</p></div> : <>
                  <div className={styles.paymentSummary}><p>Estimated monthly repayment</p><strong>{money(chatbotResults.monthlyPayment)}<span>/ month</span></strong><p>Capital and interest repayments</p></div>
                  <dl className={styles.breakdown}><div><dt>Mortgage borrowing</dt><dd>{money(chatbotResults.capitalPaid)}</dd></div><div><dt>Total interest</dt><dd>{money(chatbotResults.interestPaid)}</dd></div><div><dt>Total mortgage repayments</dt><dd>{money(chatbotResults.totalCost)}</dd></div></dl>
                </>}
                {inputs && <dl className={styles.assumptions}><div><dt>Property price</dt><dd>{money(inputs.price)}</dd></div><div><dt>Deposit</dt><dd>{money(inputs.deposit)}</dd></div><div><dt>Annual rate</dt><dd>{inputs.interestRate}%</dd></div><div><dt>Term</dt><dd>{inputs.termYears} years</dd></div></dl>}
                <p className={styles.disclaimer}>Assumes an unchanged rate over the full term. Excludes purchase taxes, fees and other buying costs.</p>
              </>
            ) : (
              <div className={styles.emptyResults}><h2>Your mortgage,<br />at a glance.</h2><div className={styles.emptyPayment}><p>Estimated monthly repayment</p><strong>&pound;&nbsp;&mdash;<span>/ month</span></strong></div><dl className={styles.breakdown}><div><dt>Mortgage borrowing</dt><dd>&mdash;</dd></div><div><dt>Total interest</dt><dd>&mdash;</dd></div><div><dt>Total mortgage repayments</dt><dd>&mdash;</dd></div></dl><div className={styles.emptyRule} /><p className={styles.disclaimer}>No assumptions. No figures until your scenario is calculated.</p></div>
            )}
            </aside>
          )}
        </div>
        <footer className={styles.footer}><span>Mortgage Assistant</span><p>Illustrative estimates, not financial advice, a mortgage offer or a lender eligibility decision.</p></footer>
      </main>
    </div>
  )
}

export default MortgageAssistant
