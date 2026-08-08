/**
 * Хранилище в памяти вместо браузерного.
 *
 * `data/store` читает localStorage прямо при импорте модуля, поэтому подменять
 * его нужно раньше, чем тест дойдёт до первого `import`, — этим и занимается
 * setupFile. Полноценный jsdom ради двух методов ставить незачем.
 */
class MemoryStorage implements Storage {
  private items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

globalThis.localStorage = new MemoryStorage()
globalThis.sessionStorage = new MemoryStorage()
