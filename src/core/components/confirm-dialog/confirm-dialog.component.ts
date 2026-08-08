import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

/** Renders whatever ConfirmDialogService is currently asking. Mounted once. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmDialogService);
}
