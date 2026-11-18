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

  it('adds no width or Clear controls: its only controls are Bit switches, Position selectors and the prediction controls', async () => {
    const h = await open();
    const names = [...root(h).querySelectorAll('button, input, select')].map((e) => e.getAttribute('aria-label') ?? e.textContent!.trim() ?? e.tagName);
    expect(names.filter((n) => !/^(Bit at|Inspect) Position/.test(n))).toEqual(['Skip prediction', '', 'Lock prediction']); // the text field has no button name
    expect(text(h)).not.toMatch(/clear|width/i);
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

const pos = (h: H, position: number) => q<HTMLButtonElement>(h, `button.pos[data-position="${position}"]`)!;
const select = async (h: H, position: number) => {
  pos(h, position).click();
  await settle(h);
};
const inspector = (h: H) => q(h, 'section[aria-label="Inspector"]')!;
/** The Inspector's property rows as { name: value }. */
const props = (h: H) =>
  Object.fromEntries([...inspector(h).querySelectorAll('dl > div')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent!.replace(/\s+/g, ' ').trim()]));
const pattern = (h: H) => rowText(h, 'Bit').join('');

describe('Inspector: nothing selected', () => {
  it('is a neutral region with one line and no properties, and no Deselect button', async () => {
    const h = await open();
    expect(inspector(h).querySelector('h2')!.textContent).toBe('Inspector');
    expect(inspector(h).textContent).toContain('Select a position to inspect it.');
    expect(inspector(h).querySelector('dl')).toBeNull();
    expect(inspector(h).querySelector('.deselect')).toBeNull();
    expect(root(h).querySelectorAll('button.pos[aria-pressed="true"]')).toHaveLength(0);
  });
});

describe('Inspector: selecting a Position', () => {
  it('shows Position, Bit, Weight and Contribution with their actual values (Position 3 of 1011)', async () => {
    const h = await open();
    await select(h, 3);
    expect(props(h)).toEqual({ Position: '3', Bit: '1', Weight: '23 = 8', Contribution: '1 × 8 = 8' });
  });

  it('shows a 0 Bit as contributing 0 (Position 2 of 1011)', async () => {
    const h = await open();
    await select(h, 2);
    expect(props(h)).toEqual({ Position: '2', Bit: '0', Weight: '22 = 4', Contribution: '0 × 4 = 0' });
    expect(inspector(h).querySelector('.why')!.textContent!.trim()).toBe('A 0 contributes 0.');
  });

  it('explains a 1 as contributing its full Weight and states how Weight and Contribution arise', async () => {
    const h = await open();
    await select(h, 0);
    expect(inspector(h).querySelector('.why')!.textContent!.trim()).toBe('A 1 contributes its full Weight.');
    expect(inspector(h).textContent).toContain('The Weight comes from the Position. The Contribution is the Bit times the Weight.');
  });

  it('does not change the pattern, the Total, the sum, the label or the announcement', async () => {
    const h = await open();
    await select(h, 2);
    expect(pattern(h)).toBe('1011');
    expect(total(h)).toBe('11');
    expect(q(h, '.sum')!.textContent).toBe('8 + 0 + 2 + 1 = 11');
    expect(q(h, '.example')).not.toBeNull(); // selecting is not changing a Bit
    expect(q(h, '.last')!.textContent).toBe('');
  });

  it('marks the selected Position with aria-pressed and a boxed column, and only one at a time', async () => {
    const h = await open();
    await select(h, 2);
    expect(pos(h, 2).getAttribute('aria-pressed')).toBe('true');
    expect(root(h).querySelectorAll('button.pos[aria-pressed="true"]')).toHaveLength(1);
    expect([...root(h).querySelectorAll('td.sel')].map((c) => c.textContent!.trim())).toEqual(['2', '4', '0', '0']);
  });

  it('switches to another Position without changing any Bit', async () => {
    const h = await open();
    await select(h, 3);
    await select(h, 1);
    expect(props(h)).toEqual({ Position: '1', Bit: '1', Weight: '21 = 2', Contribution: '1 × 2 = 2' });
    expect(pos(h, 3).getAttribute('aria-pressed')).toBe('false');
    expect(pattern(h)).toBe('1011');
    expect(total(h)).toBe('11');
  });

  it('is cleared by selecting the same Position again, and by Deselect, without changing the pattern', async () => {
    const h = await open();
    await select(h, 2);
    await select(h, 2);
    expect(inspector(h).querySelector('dl')).toBeNull();
    await select(h, 2);
    q<HTMLButtonElement>(h, '.deselect')!.click();
    await settle(h);
    expect(inspector(h).querySelector('dl')).toBeNull();
    expect(root(h).querySelectorAll('td.sel')).toHaveLength(0);
    expect(pattern(h)).toBe('1011');
  });

  it('returns focus to the Position button when Deselect removes itself', async () => {
    const h = await open();
    await select(h, 2);
    q<HTMLButtonElement>(h, '.deselect')!.click();
    await settle(h);
    expect(document.activeElement).toBe(pos(h, 2));
  });
});

describe('Inspector: staying in step with the Bench', () => {
  it('keeps the Position selected and updates its Bit and Contribution when that Bit is toggled', async () => {
    const h = await open();
    await select(h, 2);
    await flip(h, 2); // 0 -> 1
    expect(pos(h, 2).getAttribute('aria-pressed')).toBe('true');
    expect(props(h)).toEqual({ Position: '2', Bit: '1', Weight: '22 = 4', Contribution: '1 × 4 = 4' });
    expect(inspector(h).querySelector('.why')!.textContent!.trim()).toBe('A 1 contributes its full Weight.');
    expect(total(h)).toBe('15');
    expect(q(h, '.sum')!.textContent).toBe('8 + 4 + 2 + 1 = 15');
    await flip(h, 2); // 1 -> 0
    expect(props(h)['Contribution']).toBe('0 × 4 = 0');
    expect(total(h)).toBe('11');
  });

  it('is unaffected when a different Bit is toggled', async () => {
    const h = await open();
    await select(h, 3);
    await flip(h, 0);
    expect(props(h)).toEqual({ Position: '3', Bit: '1', Weight: '23 = 8', Contribution: '1 × 8 = 8' });
    expect(total(h)).toBe('10');
  });

  it('toggling a Bit does not select it, and selecting a Position does not toggle it', async () => {
    const h = await open();
    await flip(h, 1);
    expect(inspector(h).querySelector('dl')).toBeNull();
    await select(h, 1);
    expect(pattern(h)).toBe('1001');
  });

  it('starts with nothing selected when the Lab is opened again', async () => {
    const h = await open();
    await select(h, 3);
    await h.navigateByUrl('/worlds');
    await settle(h);
    await h.navigateByUrl(`/workspace/${ID_A}`);
    await settle(h);
    expect(inspector(h).querySelector('dl')).toBeNull();
    expect(root(h).querySelectorAll('button.pos[aria-pressed="true"]')).toHaveLength(0);
  });

  it('passes the learner-copy scan and draws no Library or Investigation region', async () => {
    const h = await open();
    await select(h, 3);
    expect(violations(rendered(root(h)))).toEqual([]);
    expect(root(h).querySelectorAll('[aria-label="Library"], [aria-label="Investigation"]')).toHaveLength(0);
  });
});

const field = (h: H) => q<HTMLInputElement>(h, '.prediction input')!;
const typeChange = async (h: H, value: string) => {
  const f = field(h);
  f.value = value;
  f.dispatchEvent(new Event('input'));
  await settle(h);
};
const lockBtn = (h: H) => q<HTMLButtonElement>(h, '.prediction .lock')!;
const click = async (h: H, selector: string) => {
  q<HTMLButtonElement>(h, selector)!.click();
  await settle(h);
};
const lockIt = async (h: H, position: number, value: string) => {
  await select(h, position);
  await typeChange(h, value);
  await click(h, '.prediction .lock');
};
const compare = (h: H) => {
  const rows = [...root(h).querySelectorAll('.prediction .compare dl > div')];
  return Object.fromEntries(rows.map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent!.trim()]));
};
const prediction = (h: H) => q(h, 'section[aria-label="Prediction"]');

describe('Prediction: optional, and the Bench works without it', () => {
  it('opens with the approved prompt and labels, a disabled field until a Position is selected, and Lock disabled', async () => {
    const h = await open();
    const p = prediction(h)!;
    expect(p.querySelector('h2')!.textContent).toBe('Prediction');
    expect(p.textContent).toContain('Before changing a bit, predict how the total will change.');
    expect(p.textContent).toContain('Change in Total');
    expect(p.textContent).toContain('Skip prediction');
    expect(field(h).disabled).toBe(true);
    expect(field(h).placeholder).toBe('+4 or −8'); // a signed change, not a target Total
    expect(lockBtn(h).disabled).toBe(true);
    expect(p.textContent).toContain('Select a position to predict its change.');
  });

  it('flipping works exactly as before with no prediction, and shows no comparison', async () => {
    const h = await open();
    await flip(h, 2);
    expect(total(h)).toBe('15');
    expect(q(h, '.prediction .compare')).toBeNull();
    expect(q(h, '.prediction .armed')).toBeNull();
  });

  it('Skip prediction hides the whole interaction for the session, and the Bench still works', async () => {
    const h = await open();
    await click(h, '.prediction .skip');
    expect(prediction(h)).toBeNull();
    await flip(h, 3);
    expect(total(h)).toBe('3');
    await select(h, 2);
    expect(props(h)['Position']).toBe('2');
    expect(text(h)).not.toContain('Skip prediction');
  });

  it('Skip prediction also drops a locked prediction, and a later flip of its Position reveals nothing', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await click(h, '.prediction .skip');
    await flip(h, 2);
    expect(q(h, '.compare')).toBeNull();
    expect(total(h)).toBe('15');
  });

  it('uses no scores, grades, streaks or verdict words', async () => {
    const h = await open();
    await lockIt(h, 2, '+9');
    await flip(h, 2);
    expect(prediction(h)!.textContent).not.toMatch(/\b(correct|incorrect|wrong|right|score|points?|streak|grade|well done|try again|great)\b/i);
  });
});

describe('Prediction: entering and locking', () => {
  it('Lock needs a selected Position and a signed whole number', async () => {
    const h = await open();
    await select(h, 2);
    expect(field(h).disabled).toBe(false);
    expect(lockBtn(h).disabled).toBe(true); // nothing typed
    for (const bad of ['', 'abc', '4.5', '1e3', '++4', '4 4', '12345678', '-']) {
      await typeChange(h, bad);
      expect(lockBtn(h).disabled, `"${bad}" must not lock`).toBe(true);
    }
    for (const good of ['4', '+4', '-8', '−8', ' 12 ', '0']) {
      await typeChange(h, good);
      expect(lockBtn(h).disabled, `"${good}" must lock`).toBe(false);
    }
  });

  it('locks to the Position selected at that moment, and shows the fixed Position and value without any actual change', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    const armed = q(h, '.prediction .armed')!;
    expect(armed.textContent).toContain('Position 2');
    expect(armed.textContent).toContain('Your prediction');
    expect(armed.textContent).toContain('+4');
    expect(armed.textContent).toContain('Flip the Bit at Position 2 to see the actual change.');
    expect(q(h, '.prediction input')).toBeNull(); // value and Position are now fixed
    expect(prediction(h)!.textContent).not.toContain('Actual change'); // not revealed by locking
    expect(pattern(h)).toBe('1011'); // locking is not a flip
    expect(total(h)).toBe('11');
  });

  it('Enter in the field locks, like the button', async () => {
    const h = await open();
    await select(h, 3);
    await typeChange(h, '-8');
    q<HTMLFormElement>(h, '.prediction form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(h);
    expect(q(h, '.prediction .armed')!.textContent).toContain('\u22128');
  });

  it('selecting another Position after locking does not move or change the prediction', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await select(h, 0);
    const armed = q(h, '.prediction .armed')!;
    expect(armed.textContent).toContain('Position 2');
    expect(armed.textContent).toContain('+4');
    expect(props(h)['Position']).toBe('0'); // the Inspector follows the selection as before
  });
});

describe('Prediction: flipping', () => {
  it('flipping a different Position leaves the prediction locked and pending, and reveals nothing', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 0);
    await flip(h, 3);
    expect(q(h, '.prediction .armed')!.textContent).toContain('Position 2');
    expect(q(h, '.compare')).toBeNull();
    expect(prediction(h)!.textContent).not.toContain('Actual change');
    expect(total(h)).toBe('2'); // 0010: both flips happened
  });

  it('flipping the predicted Position reveals prediction, actual change and difference together (a correct prediction)', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 2); // 1011 -> 1111
    expect(compare(h)).toEqual({ 'Your prediction': '+4', 'Actual change': '+4', Difference: '0' });
    expect(q(h, '.compare .why')!.textContent!.trim()).toBe('The Bit went 0 → 1, so the Total changed by +4.');
    expect(q(h, '.compare .where')!.textContent!.trim()).toBe('Position 2 (Weight 4)');
    expect(total(h)).toBe('15');
    expect(q(h, '.prediction .armed')).toBeNull();
  });

  it('handles a wrong prediction neutrally, with the signed difference (predicted +6, actual +4)', async () => {
    const h = await open();
    await lockIt(h, 2, '6');
    await flip(h, 2);
    expect(compare(h)).toEqual({ 'Your prediction': '+6', 'Actual change': '+4', Difference: '\u22122' });
    expect(prediction(h)!.textContent).not.toMatch(/\b(correct|wrong|incorrect)\b/i);
    expect([...q(h, '.compare')!.classList]).toEqual(['compare']); // no success or failure class
    expect([...q(h, '.compare dl')!.querySelectorAll('dd')].every((d) => !/\b(ok|good|bad|fail|success|error)\b/.test(d.className))).toBe(true);
  });

  it('shows the right signed actual change for a Bit that goes down (Position 3: 1 to 0, predicted +8)', async () => {
    const h = await open();
    await lockIt(h, 3, '+8');
    await flip(h, 3); // 1011 -> 0011, Total 3
    expect(compare(h)).toEqual({ 'Your prediction': '+8', 'Actual change': '\u22128', Difference: '\u221216' });
    expect(q(h, '.compare .why')!.textContent!.trim()).toBe('The Bit went 1 → 0, so the Total changed by \u22128.');
    expect(total(h)).toBe('3');
  });

  it('matches a prediction written with a hyphen or a minus sign for a downward flip', async () => {
    const h = await open();
    await lockIt(h, 3, '-8');
    await flip(h, 3);
    expect(compare(h)['Your prediction']).toBe('\u22128');
    expect(compare(h)['Difference']).toBe('0');
  });

  it('keeps the comparison visible through further flips, selections and a second flip of the same Position', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 2);
    const before = compare(h);
    await flip(h, 2); // back to 0: the recorded result is not overwritten
    await flip(h, 0);
    await select(h, 1);
    expect(compare(h)).toEqual(before);
    expect(q(h, '.prediction input')).toBeNull(); // no new prediction until Try another
  });
});

describe('Prediction: Try another', () => {
  it('clears the comparison and the prediction, and offers a fresh field for a new experiment', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 2);
    await click(h, '.prediction .again');
    expect(q(h, '.compare')).toBeNull();
    expect(q(h, '.armed')).toBeNull();
    expect(field(h).value).toBe('');
    expect(lockBtn(h).disabled).toBe(true);
    expect(pattern(h)).toBe('1111'); // the Bench is untouched
    expect(total(h)).toBe('15');
  });

  it('allows a second experiment on another Position, tied to that Position', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 2);
    await click(h, '.prediction .again');
    await lockIt(h, 3, '-8');
    await flip(h, 3);
    expect(compare(h)).toEqual({ 'Your prediction': '\u22128', 'Actual change': '\u22128', Difference: '0' });
    expect(total(h)).toBe('7');
  });

  it('keeps the selection when starting another experiment', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    await flip(h, 2);
    await click(h, '.prediction .again');
    expect(pos(h, 2).getAttribute('aria-pressed')).toBe('true');
    expect(field(h).disabled).toBe(false);
  });
});

describe('Prediction: the Inspector and the Bench stay in step throughout', () => {
  it('shows the selected Position correctly through lock, flip, reveal and Try another', async () => {
    const h = await open();
    await select(h, 2);
    await typeChange(h, '+4');
    await click(h, '.prediction .lock');
    expect(props(h)).toEqual({ Position: '2', Bit: '0', Weight: '22 = 4', Contribution: '0 × 4 = 0' });
    await flip(h, 2);
    expect(props(h)).toEqual({ Position: '2', Bit: '1', Weight: '22 = 4', Contribution: '1 × 4 = 4' });
    expect(inspector(h).textContent).not.toContain('Actual change'); // the comparison is not duplicated in the Inspector
    await click(h, '.prediction .again');
    expect(props(h)['Bit']).toBe('1');
    expect(q(h, '.sum')!.textContent).toBe('8 + 4 + 2 + 1 = 15');
  });

  it('does not reveal the actual change in the Inspector before the flip', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    expect(inspector(h).textContent).not.toMatch(/flipping|would|\+4|actual/i);
  });

  it('starts a reopened Lab with no prediction, nothing locked and the prompt showing', async () => {
    const h = await open();
    await click(h, '.prediction .skip');
    await h.navigateByUrl('/worlds');
    await settle(h);
    await h.navigateByUrl(`/workspace/${ID_A}`);
    await settle(h);
    expect(prediction(h)).not.toBeNull();
    expect(q(h, '.armed')).toBeNull();
  });

  it('keeps the starting example behaviour: locking does not remove the label, the first flip does, for good', async () => {
    const h = await open();
    await lockIt(h, 2, '+4');
    expect(q(h, '.example')).not.toBeNull();
    await flip(h, 2);
    expect(q(h, '.example')).toBeNull();
    await click(h, '.prediction .again');
    await flip(h, 2); // 1011 rebuilt
    expect(rowText(h, 'Bit').join('')).toBe('1011');
    expect(q(h, '.example')).toBeNull();
  });

  it('passes the learner-copy scan in every state and uses no banned vocabulary', async () => {
    const h = await open();
    expect(violations(rendered(root(h)))).toEqual([]);
    await lockIt(h, 2, '+4');
    expect(violations(rendered(root(h)))).toEqual([]);
    await flip(h, 2);
    expect(violations(rendered(root(h)))).toEqual([]);
  });
});
