import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WORKSPACE_NAME_MAX_LENGTH } from '@ele/domain';
import { describeError, isUnconfirmedCreate } from './describe-error';
import { WORKSPACE_GATEWAY, type WorkspaceDto } from './workspace-gateway';

/**
 * Create a lab (LE-014). The name goes to the host exactly as typed: the host trims, validates and
 * decides, and the frontend adds no rule (LE-019). The limit is shown from the domain, for the hint only.
 */
@Component({
  selector: 'app-lab-create-form',
  imports: [RouterLink],
  templateUrl: './lab-create-form.html',
  styleUrl: './lab-create-form.css',
})
export class LabCreateForm {
  private readonly gateway = inject(WORKSPACE_GATEWAY);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  /** A lab was created. The screen refreshes its list and marks the new row. */
  readonly created = output<WorkspaceDto>();
  /** The host could not say whether a lab was created. The screen refreshes its list. */
  readonly unconfirmed = output<void>();

  protected readonly limit = WORKSPACE_NAME_MAX_LENGTH;
  protected readonly name = signal('');
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly made = signal<WorkspaceDto | null>(null);

  protected onInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.error.set(null); // a message about the previous text no longer applies
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.creating()) return; // one creation at a time, whatever triggered the submit
    this.creating.set(true);
    this.error.set(null);
    this.made.set(null);
    const result = await this.gateway.createWorkspace(this.name());
    this.creating.set(false);
    if (!result.ok) {
      this.error.set(describeError(result.error.kind, { where: 'create', nameLimit: this.limit }));
      this.nameInput()?.nativeElement.focus();
      if (isUnconfirmedCreate(result.error.kind)) this.unconfirmed.emit();
      return;
    }
    this.name.set('');
    const field = this.nameInput()?.nativeElement;
    if (field) field.value = ''; // the field itself holds the text; clear it directly
    this.made.set(result.value);
    this.created.emit(result.value);
  }
}
