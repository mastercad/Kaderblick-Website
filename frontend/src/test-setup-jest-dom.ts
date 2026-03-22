// Extends Jest with @testing-library/jest-dom matchers
// (toBeInTheDocument, toBeDisabled, toHaveTextContent, …)
import '@testing-library/jest-dom';

afterEach(() => {
	// Keep Jest workers clean even if individual tests forget to restore timers.
	jest.clearAllTimers();
	jest.useRealTimers();
});
