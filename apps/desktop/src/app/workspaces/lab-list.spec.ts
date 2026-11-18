import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ID_A, ID_B, ID_C, invalid, valid } from './fake-gateway.testing';
import { LabList } from './lab-list';
import type { WorkspaceEntryDto } from './workspace-gateway';

function render(entries: WorkspaceEntryDto[], newId: string | null = null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LabList);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('newId', newId);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

// The component in isolation: its inputs and its one output. Behaviour in context is in worlds-screen.spec.ts.
describe('LabList', () => {
  it('orders labs newest first from whatever order it is given, then the unopenable group', () => {
    const { el } = render([invalid(ID_C, 'manifest_missing', 'x'), valid(ID_A, 'Old', '2026-01-01T00:00:00Z'), valid(ID_B, 'New', '2026-06-01T00:00:00Z')]);
    expect([...el.querySelectorAll('a.row .nm')].map((n) => n.textContent?.trim())).toEqual(['New', 'Old']);
    expect(el.querySelectorAll('li.bad')).toHaveLength(1);
  });

  it('marks only the lab it is told is new', () => {
    const { el } = render([valid(ID_A, 'A'), valid(ID_B, 'B')], ID_B);
    const tagged = [...el.querySelectorAll('a.row')].filter((r) => r.querySelector('.tag'));
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.getAttribute('href')).toBe(`/workspace/${ID_B}`);
  });

  it('renders nothing for no entries', () => {
    expect(render([]).el.textContent?.trim()).toBe('');
  });

  it('emits retry from an unreadable entry, and offers it for no other kind', () => {
    const { fixture, el } = render([invalid(ID_A, 'entry_unreadable', 'x'), invalid(ID_B, 'manifest_malformed', 'y')]);
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    expect(el.querySelectorAll('li.bad button')).toHaveLength(1);
    el.querySelector<HTMLButtonElement>('li.bad button')!.click();
    expect(retries).toBe(1);
  });

  it('never shows the host\'s message for an unopenable entry', () => {
    const { el } = render([invalid(ID_A, 'manifest_malformed', 'workspace.json is not a valid JSON object.')]);
    expect(el.textContent).not.toContain('workspace.json');
  });
});
