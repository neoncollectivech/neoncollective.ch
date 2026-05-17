"use client";
import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import NextLink from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import React from "react";

import { useDictionary } from "@/i18n/DictionaryContext";
import { siteConfig } from "@/config/site";
import { LocaleSwitcher } from "@/components/locale-switcher";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const { dictionary, locale } = useDictionary();

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen);
  }

  // Build nav items from dictionary labels + siteConfig hrefs
  const navItems = siteConfig.navItems.map((item) => ({
    href: `/${locale}${item.href === "/" ? "" : item.href}`,
    label: dictionary.nav[item.key as keyof typeof dictionary.nav] || item.key,
  }));

  return (
    <header className="sticky top-0 w-full z-50">
      <div className="mx-auto">
        <NextUINavbar
          classNames={{
            base: "bg-background border-b border-white/[0.04]",
            wrapper: "px-6",
          }}
          isMenuOpen={isMenuOpen}
          maxWidth="full"
          onMenuOpenChange={toggleMenu}
        >
          <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
            <NavbarBrand as="li" className="gap-3 max-w-fit">
              <NextLink
                className="flex justify-start items-center gap-1"
                href={`/${locale}`}
              >
                <span className="text-lg font-display font-semibold tracking-display text-neon leading-none">
                  NE
                </span>
              </NextLink>
            </NavbarBrand>
            <NavbarContent className="basis-1/5 sm:basis-full" justify="end">
              <ul className="hidden md:flex gap-8 justify-start ml-2">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== `/${locale}` &&
                      pathname.startsWith(item.href));

                  return (
                    <NavbarItem key={item.href}>
                      <NextLink
                        className={clsx(
                          "text-xs font-mono uppercase tracking-widest text-foreground/40 transition-colors duration-300 hover:text-neon",
                          isActive && "text-neon",
                        )}
                        href={item.href}
                      >
                        {item.label}
                      </NextLink>
                    </NavbarItem>
                  );
                })}
              </ul>
              <div className="hidden md:flex ml-4">
                <LocaleSwitcher />
              </div>
            </NavbarContent>
          </NavbarContent>
          <NavbarContent className="md:hidden basis-1 pl-4" justify="end">
            <div className="mr-2">
              <LocaleSwitcher />
            </div>
            <NavbarMenuToggle />
          </NavbarContent>
          <NavbarMenu>
            <div className="mx-4 mt-10 flex flex-col gap-6">
              {navItems.map((item, index) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${locale}` &&
                    pathname.startsWith(item.href));

                return (
                  <NavbarMenuItem key={`${item.href}-${index}`}>
                    <NextLink
                      className={clsx(
                        "text-xl font-mono uppercase tracking-widest text-foreground/40 transition-colors duration-200",
                        isActive && "text-neon",
                      )}
                      href={item.href}
                      onClick={toggleMenu}
                    >
                      {item.label}
                    </NextLink>
                  </NavbarMenuItem>
                );
              })}
            </div>
          </NavbarMenu>
        </NextUINavbar>
      </div>
    </header>
  );
};
