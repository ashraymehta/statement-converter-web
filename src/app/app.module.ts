import { NgModule } from '@angular/core';
import { LottieModule } from 'ngx-lottie';
import { AppComponent } from './app.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HomeComponent } from './home/home.component';
import { FormComponent } from './form/form.component';
import { AppRoutingModule } from './app-routing.module';
import { BrowserModule } from '@angular/platform-browser';
import { LoaderComponent } from './loader/loader.component';
import { NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { StatementConverter } from '@ashray.mehta/statement-converter';
import { DragDropDirective } from './directives/drag-drop/drag-drop.directive';

@NgModule({
    declarations: [
        AppComponent,
        HomeComponent,
        LoaderComponent,
        FormComponent,
        DragDropDirective
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        NgbProgressbarModule,
        ReactiveFormsModule,
        LottieModule.forRoot({ player: () => import('lottie-web') })
    ],
    providers: [FileReader, { provide: StatementConverter, useFactory: () => new StatementConverter() }],
    bootstrap: [AppComponent]
})
export class AppModule {
}
