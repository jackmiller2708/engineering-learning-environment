import { TestBed } from '@angular/core/testing';
import { LAST_LAB_STORAGE, LastLabPointer, POINTER_KEY, type PointerStorage } from './last-lab-pointer';
import { memoryStorage, throwingStorage } from './fake-storage.testing';
import { ID_A } from './fake-gateway.testing';

const make = (storage: PointerStorage | null) => {
  TestBed.configureTestingModule({ providers: [{ provide: LAST_LAB_STORAGE, useValue: storage }] });
  return TestBed.inject(LastLabPointer);
};

describe('LastLabPointer', () => {
  it('reads nothing when no pointer was written', () => {
    expect(make(memoryStorage()).read()).toBeNull();
  });

  it('round-trips a valid lab id', () => {
    const p = make(memoryStorage());
    p.write(ID_A);
    expect(p.read()).toBe(ID_A);
  });

  it('stores only the id under a versioned key', () => {
    const s = memoryStorage();
    make(s).write(ID_A);
    expect(POINTER_KEY).toBe('ele.lastLab.v1');
    expect([...s.data.entries()]).toEqual([[POINTER_KEY, ID_A]]);
  });

  it.each(['not-an-id', ID_A.toUpperCase(), `${ID_A} `, ''])('reads %j as no pointer and clears it', (bad) => {
    const s = memoryStorage({ [POINTER_KEY]: bad });
    expect(make(s).read()).toBeNull();
    expect(s.data.has(POINTER_KEY)).toBe(false);
  });

  it('refuses to write something that is not a valid id', () => {
    const s = memoryStorage();
    make(s).write('not-an-id');
    expect(s.data.size).toBe(0);
  });

  it('clears the pointer', () => {
    const s = memoryStorage({ [POINTER_KEY]: ID_A });
    make(s).clear();
    expect(s.data.size).toBe(0);
  });

  it('treats a read that throws as no pointer', () => {
    expect(make(throwingStorage()).read()).toBeNull();
  });

  it('ignores a write that throws', () => {
    expect(() => make(throwingStorage()).write(ID_A)).not.toThrow();
  });

  it('ignores a clear that throws', () => {
    expect(() => make(throwingStorage()).clear()).not.toThrow();
  });

  it('works as no pointer when storage is unavailable altogether', () => {
    const p = make(null);
    expect(p.read()).toBeNull();
    expect(() => p.write(ID_A)).not.toThrow();
    expect(() => p.clear()).not.toThrow();
  });
});
