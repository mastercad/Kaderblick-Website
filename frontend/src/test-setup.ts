/**
 * Jest Global Setup
 * 
 * Wird vor allen Tests geladen. Mockt Module die import.meta.env
 * verwenden, da Jest dies nicht nativ unterstützt.
 */

// TextEncoder/TextDecoder are used by react-router-dom but missing in older jsdom versions
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// config.ts verwendet import.meta.env — global mocken
jest.mock('../config', () => ({
  BACKEND_URL: 'http://localhost:8081',
}));

// JSDOM does not implement URL.createObjectURL / revokeObjectURL
Object.defineProperty(global.URL, 'createObjectURL', { writable: true, value: jest.fn(() => 'blob:mock-url') });
Object.defineProperty(global.URL, 'revokeObjectURL', { writable: true, value: jest.fn() });
