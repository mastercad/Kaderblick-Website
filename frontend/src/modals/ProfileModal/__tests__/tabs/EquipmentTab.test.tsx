import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EquipmentTab } from '../../tabs/EquipmentTab';
import type { ProfileData } from '../../types';

const baseForm: ProfileData = {
  firstName: '', lastName: '', email: '',
  height: '', weight: '', shoeSize: '',
  shirtSize: 'M', pantsSize: 'L', socksSize: '39-42', jacketSize: 'XL',
  password: '', confirmPassword: '',
  avatarUrl: '', useGoogleAvatar: false, googleAvatarUrl: '',
};

describe('EquipmentTab', () => {
  it('renders the Kleidungsgrößen section', () => {
    render(<EquipmentTab form={baseForm} onChange={jest.fn()} />);
    expect(screen.getByText(/Kleidungsgrößen/i)).toBeInTheDocument();
  });

  it('renders size fields (Trikot, Shorts, Trainingsjacke, Stutzen, Schuhgröße)', () => {
    render(<EquipmentTab form={baseForm} onChange={jest.fn()} />);
    expect(screen.getByLabelText(/Trikot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shorts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Trainingsjacke/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stutzen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Schuhgröße/i)).toBeInTheDocument();
  });

  it('calls onChange with updated shoeSize when the number input changes', () => {
    const onChange = jest.fn();
    render(<EquipmentTab form={baseForm} onChange={onChange} />);
    const shoeInput = screen.getByLabelText(/Schuhgröße/i);
    fireEvent.change(shoeInput, { target: { value: '43' } });
    expect(onChange).toHaveBeenCalledWith({ shoeSize: 43 });
  });

  it('calls onChange with empty string when shoeSize input is cleared', () => {
    const onChange = jest.fn();
    // Start with a non-empty shoeSize so the input has a value to clear
    render(<EquipmentTab form={{ ...baseForm, shoeSize: 42 }} onChange={onChange} />);
    const shoeInput = screen.getByLabelText(/Schuhgröße/i);
    fireEvent.change(shoeInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ shoeSize: '' });
  });

  it('calls onChange with shirtSize when Trikot option is selected', () => {
    const onChange = jest.fn();
    const { container } = render(<EquipmentTab form={baseForm} onChange={onChange} />);
    const nativeInputs = container.querySelectorAll('.MuiSelect-nativeInput');
    fireEvent.change(nativeInputs[0], { target: { value: 'S' } });
    expect(onChange).toHaveBeenCalledWith({ shirtSize: 'S' });
  });

  it('calls onChange with pantsSize when Shorts option is selected', () => {
    const onChange = jest.fn();
    const { container } = render(<EquipmentTab form={baseForm} onChange={onChange} />);
    const nativeInputs = container.querySelectorAll('.MuiSelect-nativeInput');
    fireEvent.change(nativeInputs[1], { target: { value: 'XL' } });
    expect(onChange).toHaveBeenCalledWith({ pantsSize: 'XL' });
  });

  it('calls onChange with jacketSize when Trainingsjacke option is selected', () => {
    const onChange = jest.fn();
    const { container } = render(<EquipmentTab form={baseForm} onChange={onChange} />);
    const nativeInputs = container.querySelectorAll('.MuiSelect-nativeInput');
    fireEvent.change(nativeInputs[2], { target: { value: 'L' } });
    expect(onChange).toHaveBeenCalledWith({ jacketSize: 'L' });
  });

  it('calls onChange with socksSize when Stutzen option is selected', () => {
    const onChange = jest.fn();
    const { container } = render(<EquipmentTab form={baseForm} onChange={onChange} />);
    const nativeInputs = container.querySelectorAll('.MuiSelect-nativeInput');
    fireEvent.change(nativeInputs[3], { target: { value: '43-46' } });
    expect(onChange).toHaveBeenCalledWith({ socksSize: '43-46' });
  });
});
