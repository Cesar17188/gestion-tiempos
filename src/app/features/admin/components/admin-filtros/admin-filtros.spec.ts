import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminFiltros } from './admin-filtros';

describe('AdminFiltros', () => {
  let component: AdminFiltros;
  let fixture: ComponentFixture<AdminFiltros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFiltros],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFiltros);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
