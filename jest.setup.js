// Jest setup file for Next.js 15 compatibility
// Polyfill global objects that Next.js uses

if (typeof global.Request === 'undefined') {
  global.Request = class Request {}
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {}
}

if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn()
}

// Suppress console output in tests unless explicitly needed
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  })

  console.warn = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  })
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})
