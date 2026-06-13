import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualizarPassword } from './actualizar-password';

describe('ActualizarPassword', () => {
  let component: ActualizarPassword;
  let fixture: ComponentFixture<ActualizarPassword>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualizarPassword],
    }).compileComponents();

    fixture = TestBed.createComponent(ActualizarPassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
