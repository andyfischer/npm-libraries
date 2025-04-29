import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCsvFileStream, transformToCsvFormat, CsvFormatOptions, CsvFileOptions } from '../index'
import { Stream, c_item, c_done, c_fail } from '@andyfischer/streams'
import Fs from 'fs'

vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
      end: vi.fn()
    }))
  }
}))

describe('maybeQuote function', () => {
  // Testing the internal function through its usage in transformToCsvFormat
  it('should quote strings with special characters', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: ['field1']
    }
    const output = transformToCsvFormat(input, options)
    
    let result: { line: string } | undefined
    output.pipe(evt => {
      if (evt.t === c_item) {
        result = evt.item
      }
    })
    
    input.item({ field1: 'value,with,commas' })
    expect(result?.line).toBe('"value,with,commas"')
  })
  
  it('should not quote strings without special characters', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: ['field1']
    }
    const output = transformToCsvFormat(input, options)
    
    let result: { line: string } | undefined
    output.pipe(evt => {
      if (evt.t === c_item) {
        result = evt.item
      }
    })
    
    input.item({ field1: 'normal_value' })
    expect(result?.line).toBe('normal_value')
  })
})

describe('transformToCsvFormat', () => {
  it('should transform data to CSV format with headers', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: ['name', 'age', 'city']
    }
    
    const output = transformToCsvFormat(input, options)
    
    const results: { line: string }[] = []
    output.pipe(evt => {
      if (evt.t === c_item) {
        results.push(evt.item)
      }
    })
    
    input.item({ name: 'John', age: 30, city: 'New York' })
    input.item({ name: 'Jane', age: 25, city: 'San Francisco' })
    input.done()
    
    expect(results[0].line).toBe('name,age,city')
    expect(results[1].line).toBe('John,30,New York')
    expect(results[2].line).toBe('Jane,25,San Francisco')
  })
  
  it('should handle null and undefined values', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: ['name', 'age', 'city']
    }
    
    const output = transformToCsvFormat(input, options)
    
    const results: { line: string }[] = []
    output.pipe(evt => {
      if (evt.t === c_item) {
        results.push(evt.item)
      }
    })
    
    input.item({ name: 'John', age: null, city: undefined })
    
    expect(results[1].line).toBe('John,,')
  })
  
  it('should use custom separator if provided', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: ['name', 'age'],
      seperator: '\t'
    }
    
    const output = transformToCsvFormat(input, options)
    
    const results: { line: string }[] = []
    output.pipe(evt => {
      if (evt.t === c_item) {
        results.push(evt.item)
      }
    })
    
    input.item({ name: 'John', age: 30 })
    
    expect(results[0].line).toBe('name\tage')
    expect(results[1].line).toBe('John\t30')
  })
  
  it('should handle Record<string, string> fields format', () => {
    const input = new Stream<any>()
    const options: CsvFormatOptions = {
      fields: { name: 'Name', age: 'Age' }
    }
    
    const output = transformToCsvFormat(input, options)
    
    const results: { line: string }[] = []
    output.pipe(evt => {
      if (evt.t === c_item) {
        results.push(evt.item)
      }
    })
    
    input.item({ name: 'John', age: 30 })
    
    expect(results[0].line).toBe('name,age')
    expect(results[1].line).toBe('John,30')
  })
})

describe('createCsvFileStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should create a file stream and write CSV data', () => {
    const mockWrite = vi.fn()
    const mockEnd = vi.fn()
    
    const mockWriteStream = {
      write: mockWrite,
      end: mockEnd
    }
    
    vi.mocked(Fs.createWriteStream).mockReturnValue(mockWriteStream as any)
    
    const options: CsvFileOptions = {
      filename: 'test.csv',
      fields: ['name', 'age']
    }
    
    const stream = createCsvFileStream(options)
    
    stream.item({ name: 'John', age: 30 })
    stream.item({ name: 'Jane', age: 25 })
    stream.done()
    
    expect(Fs.createWriteStream).toHaveBeenCalledWith('test.csv', { flags: undefined })
    expect(mockWrite).toHaveBeenCalledTimes(3) // Header + 2 data rows
    expect(mockWrite.mock.calls[0][0]).toBe('name,age\n')
    expect(mockWrite.mock.calls[1][0]).toBe('John,30\n')
    expect(mockWrite.mock.calls[2][0]).toBe('Jane,25\n')
    expect(mockEnd).toHaveBeenCalledTimes(1)
  })
  
  it('should handle errors properly', () => {
    const mockWrite = vi.fn()
    const mockEnd = vi.fn()
    console.error = vi.fn()
    
    const mockWriteStream = {
      write: mockWrite,
      end: mockEnd
    }
    
    vi.mocked(Fs.createWriteStream).mockReturnValue(mockWriteStream as any)
    
    const options: CsvFileOptions = {
      filename: 'test.csv',
      fields: ['name', 'age']
    }
    
    const stream = createCsvFileStream(options)
    
    stream.fail(new Error('Test error'))
    
    expect(console.error).toHaveBeenCalled()
    expect(mockEnd).toHaveBeenCalledTimes(1)
  })
})
