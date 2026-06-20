import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTabla } from './admin-tabla';

describe('AdminTabla', () => {
  let component: AdminTabla;
  let fixture: ComponentFixture<AdminTabla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTabla],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTabla);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
