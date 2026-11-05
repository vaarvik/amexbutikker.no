import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets';
import type { NearbyWidgetProps } from '../widgets/widgets.model';
import type { ExpoWidget } from '../widgets/widgets.ports';

/**
 * The "Tar de Amex?" widget: home screen (small, medium, large) and lock screen. It runs in the widget
 * extension, not in the app: everything it uses is inside the function, and it only reads the
 * props that `SnapshotNearbyWidgetService` writes.
 */
function NearbyWidget(props: NearbyWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  const here = props.here;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const background = containerBackground({ type: 'hierarchical', style: 'quinary' }, 'widget');
  const fill = frame({ maxWidth: 10_000, maxHeight: 10_000, alignment: 'topLeading' });
  // Every home screen layout opens with a card symbol and a heading about Amex.
  const title = (text: string) => (
    <HStack spacing={5}>
      <Image systemName="creditcard.fill" size={12} modifiers={[secondary]} />
      <Text modifiers={[font({ weight: 'semibold', size: 12 }), secondary]}>{text}</Text>
    </HStack>
  );
  const updated = <Text modifiers={[font({ size: 11 }), secondary]}>{props.updated}</Text>;

  // Lock screen: the place the phone is at, if any.
  if (family === 'accessoryInline') {
    return (
      <Text modifiers={here === undefined ? [] : [widgetURL(here.url)]}>
        {here === undefined ? 'Tar de Amex?' : `${here.name}: ${here.answer}`}
      </Text>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[...(here === undefined ? [] : [widgetURL(here.url)]), background]}
      >
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          {here === undefined ? 'Tar de Amex?' : here.name}
        </Text>
        <Text>{here === undefined ? 'Ingen steder rett her' : here.answer}</Text>
      </VStack>
    );
  }

  // Small: the place the phone is at, with its answer.
  if (family === 'systemSmall' && here !== undefined) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[widgetURL(here.url), fill, background]}>
        {title('TAR DE AMEX?')}
        <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(2)]}>{here.name}</Text>
        <HStack spacing={6}>
          <Image systemName={here.symbol as 'questionmark.circle'} size={18} color={here.color} />
          <Text modifiers={[font({ weight: 'semibold', size: 16 }), lineLimit(2)]}>
            {here.answer}
          </Text>
        </HStack>
        <Spacer />
        {updated}
      </VStack>
    );
  }

  // Medium and large (and small without a place): the nearest places that take Amex.
  const rows = family === 'systemLarge' ? 8 : family === 'systemMedium' ? 4 : 2;
  return (
    <VStack alignment="leading" spacing={7} modifiers={[fill, background]}>
      {title('TAR AMEX I NÆRHETEN')}
      {props.accepted.length === 0 ? (
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(3)]}>
          {props.updated === ''
            ? 'Åpne appen for å se steder i nærheten'
            : 'Ingen kjente steder i nærheten ennå'}
        </Text>
      ) : (
        props.accepted.slice(0, rows).map((place) => (
          <Link key={place.url} destination={place.url}>
            <HStack spacing={8}>
              <Image systemName="checkmark.circle.fill" size={15} color="#1E6B34" />
              <Text modifiers={[font({ weight: 'medium', size: 15 }), lineLimit(1)]}>
                {place.name}
              </Text>
              <Spacer />
              <Text modifiers={[font({ size: 13 }), secondary]}>{place.distance}</Text>
            </HStack>
          </Link>
        ))
      )}
      <Spacer />
      {updated}
    </VStack>
  );
}

/**
 * The iOS widget; `nearby-widget.tsx` is the stand-in for other platforms. A build without the
 * widget extension (an older development build) gets no widget instead of a crash.
 */
function create(): ExpoWidget<NearbyWidgetProps> | null {
  try {
    return createWidget<NearbyWidgetProps>('NearbyWidget', NearbyWidget, {
      accepted: [],
      updated: '',
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('Widget unavailable:', String(error));
    }
    return null;
  }
}

export const nearbyWidget: ExpoWidget<NearbyWidgetProps> | null = create();
