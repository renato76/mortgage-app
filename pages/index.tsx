import Link from 'next/link'

const HomePage = () => (
  <div>
    <h1>Welcome to the Mortgage Calculator</h1>
    <Link href="/mortgage-calculator">
      <button>Go to Mortgage Calculator</button>
    </Link>
  </div>
)

export default HomePage
