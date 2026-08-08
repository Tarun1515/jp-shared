import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The heading block at the top of every page: title, optional description, and
 * a slot for page-level actions.
 *
 * Renders an `<h1>`. Each routed page should have exactly one — it is the
 * landmark a screen-reader user navigates by to find out where they are.
 *
 * @example
 * <ui-page-header title="Jobs" description="Everything posted by your school">
 *   <ui-button actions variant="primary">Post a job</ui-button>
 * </ui-page-header>
 */
@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-page-header.component.html',
  styleUrl: './ui-page-header.component.scss',
})
export class UiPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
