import { mount, q, root, settle, text } from '../test-app.testing';
import { rendered, violations } from '../copy-scan.testing';
import { FakeGateway, ID_A, listOf, valid } from './fake-gateway.testing';

const open = async () => {
  const gateway = new FakeGateway();
  gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
  const h = await mount(gateway, `/workspace/${ID_A}`);
  await settle(h);
  return h;
};
type H = Awaited<ReturnType<typeof open>>;

const bits = (h: H) => [...root(h).querySelectorAll<HTMLButtonElement>('button.bit')];
/** One row of the table by its row header, as the cell texts from the highest Position down. */
const row = (h: H, name: string) =>
  [...root(h).querySelectorAll('.places tr')]
    .find((r) => r.querySelector('th')?.textContent === name)!
    .querySelectorAll('td');
const rowText = (h: H, name: string) => [...row(h, name)].map((c) => c.textContent!.trim());
const total = (h: H) => q(h, '.total .value')!.textContent!.trim();
const flip = async (h: H, position: number) => {
  bits(h).find((b) => b.getAttribute('aria-label')!.startsWith(`Bit at Position ${position},`))!.click();
  await settle(h);
};

describe('Place-value bench: the starting example', () => {
  it('shows 1011 with each Bit, Position, Weight and Contribution, highest Position on the left', async () => {
    const h = await open();
    expect(rowText(h, 'Position')).toEqual(['3', '2', '1', '0']);
    expect(rowText(h, 'Weight')).toEqual(['8', '4', '2', '1']);
    expect(rowText(h, 'Bit')).toEqual(['1', '0', '1', '1']);
    expect(rowText(h, 'Contribution')).toEqual(['8', '0', '2', '1']);
    expect(total(h)).toBe('11');
    expect(q(h, '.sum')!.textContent).toBe('8 + 0 + 2 + 1 = 11');
  });

  it('uses the approved copy exactly, and the "Starting example" label', async () => {
    const h = await open();
    const t = text(h);
    expect(t).toContain('Change the bits and observe how each position contributes to the total.');
    expect(t).toContain('Read the pattern from left to right. Each position represents a power of two, starting with the rightmost position at 2⁰.');
    expect(q(h, '.example')!.textContent).toBe('Starting example');
  });

  it('adds no prediction, width, Clear or Inspector controls', async () => {
    const h = await open();
    const names = [...root(h).querySelectorAll('button, input, select')].map((e) => e.getAttribute('aria-label') ?? e.textContent!.trim());
    expect(names.filter((n) => !n.startsWith('Bit at Position'))).toEqual([]);
    expect(text(h)).not.toMatch(/predict|clear|width/i);
  });

  it('passes the learner-copy scan', async () => {
    const h = await open();
    expect(violations(rendered(root(h)))).toEqual([]);
  });
});

describe('Place-value bench: changing a Bit', () => {
  it('updates the Bit, its Contribution and the Total immediately (Position 2: 11 to 15)', async () => {
    const h = await open();
    await flip(h, 2);
    expect(rowText(h, 'Bit')).toEqual(['1', '1', '1', '1']);
    expect(rowText(h, 'Contribution')).toEqual(['8', '4', '2', '1']);
    expect(total(h)).toBe('15');
    expect(q(h, '.sum')!.textContent).toBe('8 + 4 + 2 + 1 = 15');
  });

  it('turning the top Bit off lowers the Total by its Weight (11 to 3)', async () => {
    const h = await open();
    await flip(h, 3);
    expect(rowText(h, 'Contribution')).toEqual(['0', '0', '2', '1']);
    expect(total(h)).toBe('3');
  });

  it('each Bit is independent, and flipping again restores it', async () => {
    const h = await open();
    await flip(h, 0);
    expect(rowText(h, 'Bit')).toEqual(['1', '0', '1', '0']);
    expect(total(h)).toBe('10');
    await flip(h, 0);
    expect(rowText(h, 'Bit')).toEqual(['1', '0', '1', '1']);
    expect(total(h)).toBe('11');
  });

  it('marks the Position that changed with a cue other than colour: the announcement names it', async () => {
    const h = await open();
    await flip(h, 1);
    const marked = [...root(h).querySelectorAll('td.just')].map((c) => c.textContent!.trim());
    expect(marked).toEqual(['1', '2', '0', '0']); // Position, Weight, Bit, Contribution of Position 1 (the column)
    expect(q(h, '.last')!.textContent).toBe('Position 1 is now 0. Total 9.');
  });

  it('removes "Starting example" on the first change and never brings it back, even when 1011 is rebuilt', async () => {
    const h = await open();
    expect(q(h, '.example')).not.toBeNull();
    await flip(h, 2);
    expect(q(h, '.example')).toBeNull();
    await flip(h, 2); // back to 1011
    expect(rowText(h, 'Bit')).toEqual(['1', '0', '1', '1']);
    expect(q(h, '.example')).toBeNull();
  });

  it('starts again at 1011 with the label when the Lab is opened again', async () => {
    const h = await open();
    await flip(h, 3);
    expect(total(h)).toBe('3');
    await h.navigateByUrl('/worlds');
    await settle(h);
    await h.navigateByUrl(`/workspace/${ID_A}`);
    await settle(h);
    expect(rowText(h, 'Bit')).toEqual(['1', '0', '1', '1']);
    expect(total(h)).toBe('11');
    expect(q(h, '.example')).not.toBeNull();
  });
});

describe('Place-value bench: accessibility markup', () => {
  it('gives every Bit a native button whose name identifies its Bit, Position and value', async () => {
    const h = await open();
    expect(bits(h).map((b) => b.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
    expect(bits(h).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bit at Position 3, value 1',
      'Bit at Position 2, value 0',
      'Bit at Position 1, value 1',
      'Bit at Position 0, value 1',
    ]);
    await flip(h, 2);
    expect(bits(h)[1]!.getAttribute('aria-label')).toBe('Bit at Position 2, value 1');
  });

  it('labels the rows with row headers and keeps Weight, Contribution and Total as text', async () => {
    const h = await open();
    const heads = [...root(h).querySelectorAll('.places th[scope="row"]')].map((t) => t.textContent);
    expect(heads).toEqual(['Position', 'Weight', 'Bit', 'Contribution']);
    expect(q(h, '.total .label')!.textContent).toBe('Total');
  });

  it('has one polite live region, in the page from the start, empty until a Bit changes, and no second live region', async () => {
    const h = await open();
    const live = root(h).querySelectorAll('app-place-value-bench [aria-live], app-place-value-bench [role="status"], app-place-value-bench output');
    expect([...live].map((e) => e.getAttribute('aria-live'))).toEqual(['polite']);
    expect(live[0]!.textContent).toBe('');
    await flip(h, 2);
    expect(live[0]!.textContent).toBe('Position 2 is now 1. Total 15.');
    expect(live[0]!.getAttribute('aria-atomic')).toBe('true');
  });

  it('keeps focus on the Bit that was operated', async () => {
    const h = await open();
    const b = bits(h)[1]!;
    b.focus();
    b.click();
    await settle(h);
    expect(document.activeElement).toBe(bits(h)[1]);
  });
});
