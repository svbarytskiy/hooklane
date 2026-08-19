import { setRuntimePath } from './execution-runtime-context';

describe('setRuntimePath', () => {
  it('creates nested own properties', () => {
    const target: Record<string, unknown> = {};

    setRuntimePath(target, 'customer.profile.name', 'Ada');

    expect(target).toEqual({ customer: { profile: { name: 'Ada' } } });
  });

  it.each(['__proto__.polluted', 'constructor.prototype.polluted', 'a..b'])(
    'rejects unsafe path %s',
    (path) => {
      const target: Record<string, unknown> = {};

      expect(() => setRuntimePath(target, path, true)).toThrow('unsafe');
      expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    },
  );
});
