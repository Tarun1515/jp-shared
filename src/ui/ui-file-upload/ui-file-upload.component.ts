import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** A file the user has chosen, with the outcome of client-side validation. */
export interface UiSelectedFile {
  file: File;
  sizeKb: number;
  /** Null when the file passed validation. */
  error: string | null;
}

/**
 * Drag-and-drop file picker with client-side type and size checks.
 *
 * The checks here are a courtesy, not a control. They save the user a slow
 * upload that was always going to be rejected — but everything is validated
 * again server-side by `LocalDiskFileStorageService` against
 * `m_mdm_document_types`, because anything enforced only in a browser is not
 * enforced at all.
 *
 * @example
 * <ui-file-upload label="Registration certificate" accept=".pdf,.jpg"
 *                 [maxSizeKb]="5120" (filesChange)="onFiles($event)" />
 */
@Component({
  selector: 'ui-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-file-upload.component.html',
  styleUrl: './ui-file-upload.component.scss',
})
export class UiFileUploadComponent {
  readonly label = input<string>();
  readonly helper = input<string>();
  readonly error = input<string>();
  readonly required = input(false);
  readonly disabled = input(false);

  /** Passed to the input's `accept`, e.g. `.pdf,.jpg,.png`. */
  readonly accept = input('.pdf,.jpg,.jpeg,.png');

  /** Per-file ceiling. Defaults to the 10 MB server-side limit. */
  readonly maxSizeKb = input(10_240);

  readonly multiple = input(false);

  readonly filesChange = output<UiSelectedFile[]>();

  protected readonly selected = signal<UiSelectedFile[]>([]);
  protected readonly isDragging = signal(false);

  protected readonly acceptedExtensions = computed(() =>
    this.accept()
      .split(',')
      .map((extension) => extension.trim().toLowerCase())
      .filter((extension) => extension.length > 0),
  );

  protected readonly hasRejected = computed(() =>
    this.selected().some((entry) => entry.error !== null),
  );

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    if (this.disabled()) {
      return;
    }

    this.addFiles(event.dataTransfer?.files ?? null);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);

    // Reset so re-picking the same file still raises a change event.
    input.value = '';
  }

  protected removeAt(index: number): void {
    this.selected.update((files) => files.filter((_, i) => i !== index));
    this.filesChange.emit(this.selected());
  }

  private addFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const incoming = Array.from(fileList).map((file) => this.validate(file));

    this.selected.update((existing) =>
      this.multiple() ? [...existing, ...incoming] : incoming.slice(0, 1),
    );

    this.filesChange.emit(this.selected());
  }

  private validate(file: File): UiSelectedFile {
    const sizeKb = Math.ceil(file.size / 1024);
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    const allowed = this.acceptedExtensions();

    let error: string | null = null;

    if (allowed.length > 0 && !allowed.includes(extension)) {
      error = `${extension} files are not accepted. Allowed: ${allowed.join(', ')}.`;
    } else if (sizeKb > this.maxSizeKb()) {
      error = `This file is ${sizeKb} KB. The limit is ${this.maxSizeKb()} KB.`;
    }

    return { file, sizeKb, error };
  }
}
