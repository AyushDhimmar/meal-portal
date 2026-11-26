import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Brand green from the prototype (#0E7C66 is shade 6)
const brand: MantineColorsTuple = [
  '#E8F5F1', '#CFEDE4', '#A3DCCB', '#73C9AF', '#4BB897',
  '#2A9E80', '#0E7C66', '#0B6654', '#085043', '#053A30',
]

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand },
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    // 44px+ touch targets everywhere (US-021)
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    Autocomplete: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
    Textarea: { defaultProps: { size: 'md' } },
    NumberInput: { defaultProps: { size: 'md' } },
    InputWrapper: { defaultProps: { size: 'md' } },
    Chip: { defaultProps: { size: 'md' } },
    Card: { defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' } },
  },
})
