export function calculateRemainingBalance(
  mortgageAmount: number,
  interestRate: number,
  term: number
) {
  const monthlyInterestRate = interestRate / 12 / 100
  const totalPayments = term * 12
  const monthlyPayment =
    (mortgageAmount *
      (monthlyInterestRate *
        Math.pow(1 + monthlyInterestRate, totalPayments))) /
    (Math.pow(1 + monthlyInterestRate, totalPayments) - 1)

  let remainingBalance = mortgageAmount
  const balanceByYear = []

  for (let year = 1; year <= term; year++) {
    for (let month = 1; month <= 12; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate
      const principalPayment = monthlyPayment - interestPayment

      // Adjust the remaining balance
      remainingBalance -= principalPayment

      // Break if remaining balance is less than or equal to 0
      if (remainingBalance <= 0) {
        break
      }
    }

    balanceByYear.push({
      year: year,
      balance: +remainingBalance.toFixed(0),
    })
  }

  return balanceByYear
}
