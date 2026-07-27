import { useState } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { Button, Menu } from 'react-native-paper';

// El Menu de react-native-paper depende de medición de layout nativo para posicionarse --
// en web sus items colapsan a 0x0 (bug conocido de la librería en RN Web) y quedan
// inutilizables tanto por mouse como por teclado. Este wrapper usa un <select> HTML nativo
// en web y el Menu de Paper en nativo, con la misma API para el resto de la pantalla.
export interface PickerOption<T extends string> {
  value: T;
  label: string;
}

interface PlatformPickerProps<T extends string> {
  options: PickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function PlatformPicker<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  textColor,
  style,
}: PlatformPickerProps<T>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (Platform.OS === 'web') {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          padding: 12,
          marginBottom: 12,
          borderRadius: 4,
          border: '1px solid #79747E',
          fontSize: 16,
          width: '100%',
          backgroundColor: 'white',
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Menu
      visible={menuOpen}
      onDismiss={() => setMenuOpen(false)}
      anchor={
        <Button mode="outlined" onPress={() => setMenuOpen(true)} style={style} textColor={textColor}>
          {selected?.label ?? placeholder}
        </Button>
      }
    >
      {options.map((o) => (
        <Menu.Item
          key={o.value}
          title={o.label}
          onPress={() => {
            onChange(o.value);
            setMenuOpen(false);
          }}
        />
      ))}
    </Menu>
  );
}
