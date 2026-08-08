import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { AppConstants } from '../../core/constants/app-constants';

export type UiSortDirection = 'ASC' | 'DESC';

/** One column definition. */
export interface UiTableColumn<T> {
  /** Sent to the server as `sortBy`. Must match a whitelisted name in the procedure. */
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  /** CSS width, e.g. `12rem`. */
  width?: string;
  /** Cell value. Omit only when supplying a `rowTemplate`. */
  value?: (row: T) => string | number | null | undefined;
}

/** Emitted when a sortable header is clicked. */
export interface UiSortChange {
  sortBy: string;
  sortDirection: UiSortDirection;
}

/**
 * Data table with sorting and paging.
 *
 * Both are **server-driven**: this component renders exactly the rows it is
 * given and emits intent. It never sorts or slices locally, because it only
 * ever holds one page — sorting that page would reorder 20 rows out of 4,000
 * and look, convincingly, like it worked.
 *
 * @example
 * <ui-table
 *   [columns]="columns" [rows]="jobs()" [totalRecords]="total()"
 *   [pageNumber]="page()" [sortBy]="sortBy()" [sortDirection]="sortDir()"
 *   (sortChange)="onSort($event)" (pageChange)="onPage($event)" />
 */
@Component({
  selector: 'ui-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './ui-table.component.html',
  styleUrl: './ui-table.component.scss',
})
export class UiTableComponent<T> {
  readonly columns = input.required<readonly UiTableColumn<T>[]>();
  readonly rows = input<readonly T[]>([]);

  /** Caption for assistive technology. Describe what the table contains. */
  readonly caption = input<string>();

  readonly loading = input(false);
  readonly striped = input(false);
  readonly hoverable = input(true);
  readonly compact = input(false);

  // ---- sorting ------------------------------------------------------------
  readonly sortBy = input<string>();
  readonly sortDirection = input<UiSortDirection>('ASC');
  readonly sortChange = output<UiSortChange>();

  // ---- paging -------------------------------------------------------------
  readonly pageNumber = input(AppConstants.paging.defaultPageNumber);
  readonly pageSize = input(AppConstants.paging.defaultPageSize);
  readonly totalRecords = input(0);
  readonly showPager = input(true);
  readonly pageChange = output<number>();

  // ---- empty state --------------------------------------------------------
  readonly emptyTitle = input('Nothing to show');
  readonly emptyMessage = input<string>();

  /**
   * Optional custom row renderer. Receives the row as `$implicit`, so a
   * consumer can render badges, links and action buttons per cell:
   *
   * `<ng-template #rowTpl let-row><td>…</td></ng-template>`
   */
  readonly rowTemplate = input<TemplateRef<{ $implicit: T; index: number }>>();

  protected readonly totalPages = computed(() => {
    const size = this.pageSize();
    return size <= 0 ? 0 : Math.ceil(this.totalRecords() / size);
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  protected readonly firstRowIndex = computed(() =>
    this.totalRecords() === 0 ? 0 : (this.pageNumber() - 1) * this.pageSize() + 1,
  );

  protected readonly lastRowIndex = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalRecords()),
  );

  /**
   * A sliding window of page numbers, with -1 marking a gap.
   *
   * Rendering every page is fine at 8 pages and unusable at 400, which a job
   * list will reach.
   */
  protected readonly pageWindow = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.pageNumber();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [1];

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      pages.push(-1);
    }

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    if (end < total - 1) {
      pages.push(-1);
    }

    pages.push(total);
    return pages;
  });

  protected ariaSort(column: UiTableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) {
      return null;
    }
    if (this.sortBy() !== column.key) {
      return 'none';
    }
    return this.sortDirection() === 'ASC' ? 'ascending' : 'descending';
  }

  protected onSort(column: UiTableColumn<T>): void {
    if (!column.sortable) {
      return;
    }

    // Clicking the active column flips direction; a new column starts ascending.
    const sortDirection: UiSortDirection =
      this.sortBy() === column.key && this.sortDirection() === 'ASC' ? 'DESC' : 'ASC';

    this.sortChange.emit({ sortBy: column.key, sortDirection });
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
      return;
    }
    this.pageChange.emit(page);
  }

  protected cellValue(column: UiTableColumn<T>, row: T): string {
    const value = column.value?.(row);
    return value === null || value === undefined ? '—' : String(value);
  }
}
