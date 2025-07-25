import {Component} from '@angular/core';

@Component({
    selector: 'app-root',
    template: `
      <nav class="navbar d-flex flex-row-reverse">
        <a href="https://github.com/ashraymehta/statement-converter-angular" target="_blank">
          <svg width="33" height="33" viewBox="0 0 33 33"><title>Github Link</title>
            <path d="M16.6.46C7.6.46.33 7.76.33 16.76c0 7.17 4.67 13.3 11.14 15.43.8.1 1.1-.4 1.1-.8v-2.8c-4.54.9-5.5-2.2-5.5-2.2-.74-1.9-1.8-2.4-1.8-2.4-1.48-1 .1-1 .1-1 1.64.1 2.5 1.7 2.5 1.7 1.45 2.4 3.8 1.7 4.74 1.3.2-1.1.6-1.8 1.1-2.2-3.6-.4-7.4-1.8-7.4-8.1 0-1.8.7-3.28 1.7-4.4-.1-.4-.7-2.1.2-4.3 0 0 1.4-.48 4.5 1.63 1.3-.36 2.7-.54 4.1-.55 1.4 0 2.8.2 4.1.57 3.1-2.1 4.48-1.7 4.48-1.7.9 2.24.33 3.9.17 4.3 1 1.2 1.6 2.64 1.6 4.44 0 6.23-3.8 7.6-7.43 8 .6.5 1.1 1.5 1.1 3.04v4.47c0 .43.27.94 1.1.8 6.45-2.1 11.1-8.2 11.1-15.4 0-9-7.3-16.3-16.3-16.3"
                  fill="#161514"></path>
          </svg>
        </a>
      </nav>

      
      <div class="container" style="height: calc(100vh - 49px)">
        <app-toasts aria-live="polite" aria-atomic="true"></app-toasts>
        <router-outlet></router-outlet>
      </div>`,
    standalone: false
})
export class AppComponent {
}
