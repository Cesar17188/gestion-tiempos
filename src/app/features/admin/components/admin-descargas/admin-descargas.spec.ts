import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDescargas } from './admin-descargas';

describe('AdminDescargas', () => {
  let component: AdminDescargas;
  let fixture: ComponentFixture<AdminDescargas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDescargas],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDescargas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
