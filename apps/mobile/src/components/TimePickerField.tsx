import { useState } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// Mismo criterio que PlatformPicker.tsx: el picker nativo (@react-native-community/datetimepicker)
// no tiene implementación web, así que en web se usa un <input type="time"> nativo del navegador.
interface TimePickerFieldProps {
  label: string;
  value: string | null; // "HH:mm"
  onChange: (value: string) => void;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

function timeStringToDate(time: string | null): Date {
  const date = new Date();
  const [hour, minute] = (time ?? '00:00').split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimePickerField({ label, value, onChange, textColor, style }: TimePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={{
          padding: 12,
          marginBottom: 12,
          borderRadius: 4,
          border: '1px solid #79747E',
          fontSize: 16,
          width: '100%',
          backgroundColor: 'white',
        }}
      />
    );
  }

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android cierra el diálogo solo; iOS ('default' -> compact) no necesita cierre manual aquí.
    setShowPicker(false);
    if (event.type === 'set' && selectedDate) {
      onChange(dateToTimeString(selectedDate));
    }
  };

  return (
    <>
      <Button mode="outlined" onPress={() => setShowPicker(true)} style={style} textColor={textColor}>
        {value ? `${label}: ${value}` : label}
      </Button>
      {showPicker && <DateTimePicker value={timeStringToDate(value)} mode="time" is24Hour={false} onChange={handleChange} />}
    </>
  );
}
