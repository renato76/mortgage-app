'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/router'

const HomePage = () => {
  const router = useRouter()

  useEffect(() => {
    router.push('/mortgage-assistant')
  }, [router])

  return null
}

export default HomePage
