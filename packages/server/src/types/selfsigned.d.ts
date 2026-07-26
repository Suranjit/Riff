declare module 'selfsigned' {
  interface Attribute {
    name: string;
    value: string;
  }
  interface Options {
    days?: number;
    keySize?: number;
    algorithm?: string;
  }
  interface Pems {
    private: string;
    public: string;
    cert: string;
    fingerprint: string;
  }
  export function generate(attrs?: Attribute[], opts?: Options): Pems;
  const _default: { generate: typeof generate };
  export default _default;
}
