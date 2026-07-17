// Vitest global setup: jest-dom matchers (toBeInTheDocument, etc.) and
// automatic DOM cleanup between tests so renders never leak across cases.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
