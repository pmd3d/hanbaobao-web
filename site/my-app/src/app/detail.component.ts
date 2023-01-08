import { Component, Input } from "@angular/core";
import { Word } from "./search.component";

@Component({
    selector : "definitions",
    template : '<ul><h3>Lookup Results</h3><li *ngFor="let w of words">{{ w.pinyin }}</li></ul>',
    styleUrls: ['./app.component.css']
})
export class DetailComponent
{
    @Input() words : Word[] = [];
}