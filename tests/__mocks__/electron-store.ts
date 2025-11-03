class MockStore<T extends Record<string, any>> {
  private data: T;

  constructor(options: { defaults: T; schema?: any; name?: string; cwd?: string }) {
    this.data = { ...options.defaults };
  }

  get store(): T {
    return { ...this.data };
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
  }

  clear(): void {
    this.data = {} as T;
  }

  get path(): string {
    return '/mock/path/settings.json';
  }

  onDidChange<K extends keyof T>(
    _key: K,
    _callback: (newValue: T[K], oldValue: T[K]) => void
  ): () => void {
    return jest.fn();
  }
}

export default MockStore;
