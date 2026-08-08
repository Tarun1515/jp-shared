import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type UiModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Modal dialog with header, projected body and footer.
 *
 * For a simple yes/no, use `ConfirmDialogService` instead — it is one `await`
 * and needs no markup. This is for anything with a form or real content in it.
 *
 * @example
 * <ui-modal [open]="editOpen()" title="Edit branch" (closed)="editOpen.set(false)">
 *   <form>…</form>
 *   <ng-container footer>
 *     <ui-button variant="primary" (click)="save()">Save</ui-button>
 *   </ng-container>
 * </ui-modal>
 */
@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-modal.component.html',
  styleUrl: './ui-modal.component.scss',
})
export class UiModalComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly size = input<UiModalSize>('md');

  /**
   * Whether clicking the backdrop closes the dialog.
   *
   * Turn this off for a form with unsaved changes — losing a half-completed
   * job posting to a stray click is not a recoverable mistake.
   */
  readonly closeOnBackdrop = input(true);

  readonly showClose = input(true);

  readonly closed = output<void>();

  protected onBackdrop(): void {
    if (this.closeOnBackdrop()) {
      this.closed.emit();
    }
  }

  protected onEscape(): void {
    // Escape always closes, even when the backdrop does not. A modal with no
    // keyboard way out is a trap.
    this.closed.emit();
  }
}
