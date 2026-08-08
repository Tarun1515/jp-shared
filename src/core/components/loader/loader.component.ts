import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoaderService } from '../../services/loader.service';

/**
 * Global loading overlay, driven by the in-flight request count.
 *
 * Mounted once in the root template rather than per page, so it covers
 * navigation and background work as well as page-level requests.
 */
@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
})
export class LoaderComponent {
  protected readonly loader = inject(LoaderService);
}
