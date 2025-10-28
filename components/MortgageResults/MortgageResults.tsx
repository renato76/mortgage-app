interface MortgageResultsProps {
  monthlyPayment?: number
  totalCost?: number
  capitalPaid?: number
  interestPaid?: number
}

const MortgageResults = ({
  monthlyPayment,
  totalCost,
  capitalPaid,
  interestPaid,
}: MortgageResultsProps) => {
  if (
    monthlyPayment === undefined ||
    totalCost === undefined ||
    capitalPaid === undefined ||
    interestPaid === undefined
  ) {
    return null
  }

  return (
    <div className="mt-8 md:mt-0 p-6 border-[14px] border-gray-300 rounded-lg h-5/6">
      <h2 className="text-2xl font-semibold mb-4">Mortgage Results</h2>
      <p className="text-lg">
        Monthly Payment:{' '}
        <span className="font-semibold">£{monthlyPayment.toFixed(2)}</span>
      </p>
      <p className="text-lg">
        Total Cost:{' '}
        <span className="font-semibold">£{totalCost.toFixed(2)}</span>
      </p>
      <p className="text-lg">
        Capital Paid:{' '}
        <span className="font-semibold">£{capitalPaid.toFixed(2)}</span>
      </p>
      <p className="text-lg">
        Interest Paid:{' '}
        <span className="font-semibold">£{interestPaid.toFixed(2)}</span>
      </p>
    </div>
  )
}

export default MortgageResults
