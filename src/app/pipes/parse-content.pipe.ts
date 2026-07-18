import { Pipe, PipeTransform } from '@angular/core';
import { parseContent, ParsedContent } from '../utils/content-parser.utils';

@Pipe({
  name: 'parseContent',
  standalone: true,
  pure: true
})
export class ParseContentPipe implements PipeTransform {
  transform(value: string): ParsedContent {
    return parseContent(value);
  }
}
