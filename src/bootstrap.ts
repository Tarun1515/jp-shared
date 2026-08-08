import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';

/**
 * Bootstraps the remote's own probe page (see app.component.ts).
 *
 * Split from main.ts because Native Federation must install the import map
 * before any Angular code is evaluated — main.ts awaits initFederation and
 * only then dynamically imports this file.
 */
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).catch((err) => console.error(err));
