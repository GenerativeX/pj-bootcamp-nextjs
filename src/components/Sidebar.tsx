"use client";

import { type LinkItemProps, LinkItems, SITE_METADATA } from "@/lib/constant";
import {
  Box,
  Flex,
  type FlexProps,
  Icon,
  Text,
  Separator,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const isLinkActive = (pathname: string, href: string): boolean => {
  return href === "/" ? pathname === href : pathname.startsWith(href);
};

export default function Sidebar({ children }: { children: ReactNode }) {
  return (
    <Box bg="gray.50" display="flex" minH="100vh" overflow="hidden">
      <Box
        bg="white"
        borderRight="1px"
        borderRightColor="gray.200"
        w="260px"
        pos="fixed"
        h="full"
        boxShadow="sm"
      >
        <Flex direction="column" h="full">
          <Flex
            h="20"
            alignItems="center"
            mx="6"
            justifyContent="space-between"
            flexShrink={0}
          >
            <Link href="/">
              <Text fontSize="xl" fontWeight="bold" color="blue.600">
                {SITE_METADATA.NAME}
              </Text>
            </Link>
          </Flex>

          <Separator />

          <Box flex="1" overflowY="auto" py={4}>
            {LinkItems.map((link) => (
              <NavItem key={link.name} item={link} />
            ))}
          </Box>
        </Flex>
      </Box>
      <Box flex="1" ml="260px" overflow="hidden" maxW="calc(100% - 260px)">
        {children}
      </Box>
    </Box>
  );
}

interface NavItemProps extends FlexProps {
  item: LinkItemProps;
}

const NavItem = ({ item, ...rest }: NavItemProps) => {
  const { name, icon, href } = item;
  const pathname = usePathname();
  const isActive = isLinkActive(pathname, href);

  return (
    <Link href={href}>
      {/* biome-ignore lint/a11y/useSemanticElements: Chakra UI uses Flex with role for styling flexibility */}
      <Flex
        align="center"
        p="3"
        fontSize="14"
        mx="3"
        my="1"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        bg={isActive ? "blue.50" : "transparent"}
        color={isActive ? "blue.700" : "gray.700"}
        fontWeight={isActive ? "600" : "normal"}
        borderLeft={isActive ? "3px solid" : "3px solid transparent"}
        borderLeftColor={isActive ? "blue.500" : "transparent"}
        transition="all 0.2s"
        _hover={{
          bg: "blue.50",
          color: "blue.700",
          transform: "translateX(2px)",
        }}
        {...rest}
      >
        <Icon
          mr="3"
          fontSize="18"
          color={isActive ? "blue.500" : "gray.500"}
          _groupHover={{
            color: "blue.500",
          }}
          as={icon}
        />
        {name}
      </Flex>
    </Link>
  );
};
