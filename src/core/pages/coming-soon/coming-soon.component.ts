import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/**
 * Placeholder for routes whose feature has not been built yet.
 *
 * Every layout's navigation is wired to its final routes from day one, so the
 * shell is navigable and the route contract is fixed before the features land.
 * Supply a label through route data:
 *
 * @example
 * { path: 'jobs', component: ComingSoonComponent, data: { title: 'Jobs' } }
 */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title = toSignal(
    this.route.data.pipe(map((data) => (data['title'] as string | undefined) ?? 'Coming soon')),
    { initialValue: 'Coming soon' },
  );
}
