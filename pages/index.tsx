import Link from 'next/link'

const HomePage = () => (
  <div className="mx-auto bg-[#03133a] min-h-screen pb-24 p-8 text-white flex flex-col items-center justify-center">
    <div className="w-full max-w-md text-center">
      <h1 className="text-3xl font-bold mb-8">
        Welcome to the Mortgage Calculator
      </h1>
      <div className="flex flex-col space-y-4">
        <Link href="/mortgage-calculator">
          <button className="w-full bg-[#00c99a] text-[#03133a] py-4 px-6 rounded-lg font-semibold text-lg hover:bg-[#00b088] transition-colors duration-200 shadow-lg">
            Go to Mortgage Calculator
          </button>
        </Link>
        <Link href="/mortgage-assistant">
          <button className="w-full bg-[#00c99a] text-[#03133a] py-4 px-6 rounded-lg font-semibold text-lg hover:bg-[#00b088] transition-colors duration-200 shadow-lg">
            Go to Mortgage Assistant
          </button>
        </Link>
      </div>
    </div>
  </div>
)

export default HomePage
