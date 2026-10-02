import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  ActionSheet,
  Avatar,
  Badge,
  Button,
  ChatInput,
  Dot,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  MessageBubble,
  TextField,
  confirm,
  useToast,
} from "@/components/ui";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3 border-b border-zinc-200 px-4 py-6 dark:border-zinc-800">
      <Text className="text-xs font-bold uppercase tracking-wide text-zinc-400">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function Playground() {
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const toast = useToast();

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Component Playground" right={<Text>🎨</Text>} />
      <ScrollView>
        <Section title="Button">
          <Button onPress={() => {}}>Primary</Button>
          <Button variant="secondary" onPress={() => {}}>
            Secondary
          </Button>
          <Button variant="destructive" onPress={() => {}}>
            Destructive
          </Button>
          <Button variant="ghost" onPress={() => {}}>
            Ghost
          </Button>
          <Button loading onPress={() => {}}>
            Loading
          </Button>
          <Button disabled onPress={() => {}}>
            Disabled
          </Button>
        </Section>

        <Section title="TextField">
          <TextField label="Email" placeholder="you@example.com" />
          <TextField label="Mật khẩu" secureTextEntry />
          <TextField
            label="Có lỗi"
            error="Email không hợp lệ"
            defaultValue="sai-email"
          />
        </Section>

        <Section title="Avatar">
          <View className="flex-row items-center gap-4">
            <Avatar name="Nguyễn Văn A" />
            <Avatar name="Trần Thị B" online />
            <Avatar
              name="Zahuu"
              uri="https://i.pravatar.cc/150?img=12"
              online
              size={56}
            />
          </View>
        </Section>

        <Section title="Badge">
          <View className="flex-row items-center gap-4">
            <Badge count={3} />
            <Badge count={120} />
            <Dot />
          </View>
        </Section>

        <Section title="ListRow">
          <ListRow
            leading={<Avatar name="Lê Văn C" online />}
            title="Lê Văn C"
            subtitle="Bạn: Hẹn gặp lúc 7h nhé"
            trailing={<Dot />}
            onPress={() => {}}
          />
          <ListRow
            leading={<Avatar name="Nhóm Dev" />}
            title="Nhóm Dev"
            subtitle="Tin nhắn đã thu hồi"
            onPress={() => {}}
          />
        </Section>

        <Section title="EmptyState / ErrorState">
          <View className="h-48">
            <EmptyState
              title="Chưa có cuộc trò chuyện nào"
              ctaLabel="Tìm bạn bè"
              onPressCta={() => {}}
            />
          </View>
          <View className="h-48">
            <ErrorState onRetry={() => {}} />
          </View>
        </Section>

        <Section title="ActionSheet / Confirm / Toast">
          <Button variant="secondary" onPress={() => setActionSheetOpen(true)}>
            Mở Action Sheet
          </Button>
          <Button
            variant="secondary"
            onPress={async () => {
              const ok = await confirm({
                title: "Rời nhóm?",
                message: "Bạn sẽ không nhận được tin nhắn mới.",
                destructive: true,
                confirmLabel: "Rời nhóm",
              });
              toast.show(ok ? "Đã rời nhóm" : "Đã hủy");
            }}
          >
            Mở Confirm Dialog
          </Button>
          <Button
            variant="secondary"
            onPress={() => toast.show("Đã sao chép link mời")}
          >
            Hiện Toast
          </Button>
        </Section>

        <Section title="MessageBubble">
          <MessageBubble
            isOwn
            senderName="Tôi"
            message={{
              id: "1",
              type: "TEXT",
              content: "Chào bạn!",
              isRecalled: false,
              replyTo: null,
            }}
          />
          <MessageBubble
            isOwn={false}
            senderName="Trần Thị B"
            message={{
              id: "2",
              type: "TEXT",
              content: "Chào, khỏe không?",
              isRecalled: false,
              replyTo: { content: "Chào bạn!", isRecalled: false },
              reactionEmojis: ["like", "love"],
            }}
          />
          <MessageBubble
            isOwn
            senderName="Tôi"
            message={{
              id: "3",
              type: "TEXT",
              content: "Tin này sẽ bị thu hồi",
              isRecalled: true,
              replyTo: null,
            }}
          />
          <MessageBubble
            isOwn={false}
            senderName="Trần Thị B"
            message={{
              id: "4",
              type: "FILE",
              content: null,
              mediaName: "bao-cao-quy-3.pdf",
              mediaSize: 2_400_000,
              isRecalled: false,
              replyTo: null,
            }}
          />
        </Section>
      </ScrollView>

      <ChatInput
        onSend={(text) => toast.show(`Gửi: ${text}`)}
        onAttach={() => toast.show("Mở chọn ảnh/file")}
      />

      <ActionSheet
        visible={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        items={[
          {
            key: "reply",
            label: "Trả lời",
            icon: "arrow-undo-outline",
            onPress: () => toast.show("Trả lời"),
          },
          {
            key: "recall",
            label: "Thu hồi",
            icon: "trash-outline",
            destructive: true,
            onPress: () => toast.show("Thu hồi"),
          },
        ]}
      />
    </View>
  );
}
