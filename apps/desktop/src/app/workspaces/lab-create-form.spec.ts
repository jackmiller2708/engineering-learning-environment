import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WORKSPACE_NAME_MAX_LENGTH } from '@ele/domain';
import { FakeGateway, ID_B, failure } from './fake-gateway.testing';
import { LabCreateForm } from './lab-create-form';
import { WORKSPACE_GATEWAY, type WorkspaceDto } from './workspace-gateway';

function render(gateway: FakeGateway) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: WORKSPACE_GATEWAY, useValue: gateway }] });
  const fixture = TestBed.createComponent(LabCreateForm);
  const created: WorkspaceDto[] = [];
  let unconfirmed = 0;
  fixture.componentInstance.created.subscribe((l) => created.push(l));
  fixture.componentInstance.unconfirmed.subscribe(() => unconfirmed++);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const submit = async (value: string) => {
    const input = el.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { el, submit, created, unconfirmed: () => unconfirmed };
}

// The component in isolation: its outputs and its own states. The screen's reaction to them is in worlds-screen.spec.ts.
describe('LabCreateForm', () => {
  it('shows the limit from the domain before anything is submitted', () => {
    const { el } = render(new FakeGateway());
    expect(el.querySelector('#lab-name-hint')?.textContent).toBe(`Up to ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
    expect(el.querySelector('[role=status]')).not.toBeNull(); // present before it has anything to say
  });

  it('emits created, with the host\'s lab, and not unconfirmed', async () => {
    const f = render(new FakeGateway());
    await f.submit('Alpha');
    expect(f.created).toEqual([{ id: ID_B, name: 'Alpha', createdAt: '2026-11-17T07:05:09Z' }]);
    expect(f.unconfirmed()).toBe(0);
    expect(f.el.querySelector('[role=status]')?.textContent).toContain('Created “Alpha”.');
  });

  it('emits unconfirmed, and not created, only when the host cannot say whether a lab was made', async () => {
    const sure = new FakeGateway();
    sure.onCreate = async () => failure('storage_write_failed', 'x');
    const a = render(sure);
    await a.submit('Alpha');
    expect(a.unconfirmed()).toBe(0);
    expect(a.created).toEqual([]);
    TestBed.resetTestingModule();
    const unsure = new FakeGateway();
    unsure.onCreate = async () => failure('internal_error', 'x');
    const b = render(unsure);
    await b.submit('Alpha');
    expect(b.unconfirmed()).toBe(1);
    expect(b.created).toEqual([]);
  });
});
